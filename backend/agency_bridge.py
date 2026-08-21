import uuid
import time
import json
import os
from typing import Dict, List, Any, Optional

DATA_FILE = "agency_data.json"

# Demo clients seeded into DynamoDB on first connect (idempotent — existing
# items are never overwritten). Keeps the dashboard populated on a fresh table.
DEMO_CLIENTS = [
    {"id": "client_1", "name": "Nike India", "industry": "Apparel", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg"},
    {"id": "client_2", "name": "Starbucks Reserve", "industry": "F&B", "logo": "https://upload.wikimedia.org/wikipedia/en/d/d3/Starbucks_Corporation_Logo_2011.svg"},
    {"id": "client_3", "name": "Local Gym Co.", "industry": "Fitness", "logo": None},
]


class AgencyBridge:
    """
    Agency Bridge (B2B Multi-tenant module)
    Persistent store for agency clients and shared campaign feedback threads.

    Storage modes:
      - DynamoDB (default in Lambda): single table (env DYNAMODB_AGENCY_TABLE,
        default "avoir-agency") with composite key pk/sk:
            pk="CLIENT"   sk=<client_id>  -> client record
            pk="CAMPAIGN" sk=<link_id>    -> shared campaign + thread
        Survives Lambda restarts and cold starts.
      - Local fallback: when boto3/AWS creds/table are unavailable, falls back
        to an in-memory dict mirrored to DATA_FILE (previous behavior), so
        local dev needs zero AWS configuration.

    Table provisioning (run once):
        aws dynamodb create-table \
          --table-name avoir-agency \
          --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
          --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
          --billing-mode PAY_PER_REQUEST
    """

    def __init__(self, dynamo_resource=None):
        # Injected for tests; when None, boto3 is imported lazily on first use.
        self._injected_dynamo = dynamo_resource
        self.table_name = os.environ.get("DYNAMODB_AGENCY_TABLE", "avoir-agency")
        self._table = None
        self._dynamo_checked = False

        self.clients: List[Dict[str, Any]] = [dict(c) for c in DEMO_CLIENTS]
        self.shared_campaigns: Dict[str, Dict[str, Any]] = {}
        self._load_data()

    # ------------------------------------------------------------------
    # DynamoDB plumbing
    # ------------------------------------------------------------------

    def _get_table(self):
        """Return the DynamoDB Table resource, or None if unavailable.

        Probed once per process; any failure (missing boto3, no credentials,
        missing table) permanently downgrades this instance to file-backed
        mode so endpoints never crash on storage errors.
        """
        if self._dynamo_checked:
            return self._table
        self._dynamo_checked = True

        try:
            import boto3

            if self._injected_dynamo is not None:
                dynamodb = self._injected_dynamo
            else:
                dynamodb = boto3.resource(
                    "dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1")
                )
            table = dynamodb.Table(self.table_name)
            table.load()  # Raises if the table does not exist / no creds.
            self._table = table
            self._seed_demo_clients()
            print(f"[agency_bridge] Using DynamoDB table '{self.table_name}'")
        except Exception as e:
            print(
                f"[agency_bridge] DynamoDB unavailable ({e}); "
                f"falling back to file-backed store '{DATA_FILE}'"
            )
            self._table = None
        return self._table

    def _seed_demo_clients(self):
        """Insert demo clients only if they are not already persisted."""
        table = self._table
        if table is None:
            return
        for client in DEMO_CLIENTS:
            try:
                table.put_item(
                    Item={
                        "pk": "CLIENT",
                        "sk": client["id"],
                        "name": client["name"],
                        "industry": client["industry"],
                        "logo": client["logo"],
                        "agency_id": "default_agency",
                    },
                    ConditionExpression="attribute_not_exists(pk)",
                )
            except table.meta.client.exceptions.ConditionalCheckFailedException:
                pass  # Already seeded (or user-edited) — never overwrite.
            except Exception as e:
                print(f"[agency_bridge] Failed to seed client {client['id']}: {e}")

    # ------------------------------------------------------------------
    # File-backed fallback (local dev without AWS)
    # ------------------------------------------------------------------

    def _load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    self.shared_campaigns = json.load(f)
            except Exception as e:
                print(f"Error loading agency data: {e}")
                self.shared_campaigns = {}

    def _save_data(self):
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(self.shared_campaigns, f, indent=2)
        except Exception as e:
            print(f"Error saving agency data: {e}")

    # ------------------------------------------------------------------
    # Public API (unchanged signatures — server.py needs no edits)
    # ------------------------------------------------------------------

    def get_clients(self, agency_id: str = "default_agency") -> List[Dict[str, Any]]:
        table = self._get_table()
        if table is not None:
            try:
                from boto3.dynamodb.conditions import Key

                resp = table.query(
                    KeyConditionExpression=Key("pk").eq("CLIENT"),
                    FilterExpression=Key("agency_id").eq(agency_id),
                )
                items = resp.get("Items", [])
                if items:
                    return [
                        {
                            "id": item["sk"],
                            "name": item.get("name"),
                            "industry": item.get("industry"),
                            "logo": item.get("logo"),
                        }
                        for item in items
                    ]
            except Exception as e:
                print(f"[agency_bridge] get_clients query failed: {e}")
        return self.clients

    def generate_share_link(self, agency_id: str, campaign_data: Dict[str, Any]) -> str:
        link_id = str(uuid.uuid4())[:12]

        public_data = {
            "hook": campaign_data.get("hook", ""),
            "offer": campaign_data.get("offer", ""),
            "cta": campaign_data.get("cta", ""),
            "captions": campaign_data.get("captions", []),
            "image_url": campaign_data.get("image_url", ""),
            "agency_id": agency_id,
            "created_at": int(time.time()),
            "status": "PENDING_APPROVAL",
            "thread": [],  # List of dicts: {"sender": "client"|"avoir", "text": "...", "timestamp": 123}
        }

        table = self._get_table()
        if table is not None:
            try:
                table.put_item(Item={"pk": "CAMPAIGN", "sk": link_id, **public_data})
                return f"/client-approval/{link_id}"
            except Exception as e:
                print(f"[agency_bridge] DynamoDB put failed, using fallback: {e}")

        self.shared_campaigns[link_id] = public_data
        self._save_data()

        return f"/client-approval/{link_id}"

    def _get_campaign_anywhere(self, link_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a campaign from DynamoDB first, then the local fallback."""
        table = self._get_table()
        if table is not None:
            try:
                resp = table.get_item(Key={"pk": "CAMPAIGN", "sk": link_id})
                item = resp.get("Item")
                if item:
                    return {k: v for k, v in item.items() if k not in ("pk", "sk")}
            except Exception as e:
                print(f"[agency_bridge] DynamoDB get failed: {e}")
        return self.shared_campaigns.get(link_id)

    def _persist_campaign(self, link_id: str, campaign: Dict[str, Any]):
        """Write a campaign back to whichever store it came from."""
        table = self._get_table()
        if table is not None:
            try:
                table.put_item(Item={"pk": "CAMPAIGN", "sk": link_id, **campaign})
                return
            except Exception as e:
                print(f"[agency_bridge] DynamoDB put failed, using fallback: {e}")
        self.shared_campaigns[link_id] = campaign
        self._save_data()

    def get_shared_campaign(self, link_id: str) -> Optional[Dict[str, Any]]:
        return self._get_campaign_anywhere(link_id)

    def add_feedback(self, link_id: str, text: str, sender: str = "client") -> Optional[Dict[str, Any]]:
        """Add a comment to the thread."""
        campaign = self._get_campaign_anywhere(link_id)
        if campaign:
            if "thread" not in campaign:
                campaign["thread"] = []
            campaign["thread"].append({
                "sender": sender,
                "text": text,
                "timestamp": int(time.time())
            })
            self._persist_campaign(link_id, campaign)
            return campaign
        return None

    def update_campaign_variant(self, link_id: str, new_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update the campaign with the newly revised data from the AI."""
        campaign = self._get_campaign_anywhere(link_id)
        if campaign:
            campaign["hook"] = new_data.get("hook", campaign["hook"])
            campaign["offer"] = new_data.get("offer", campaign["offer"])
            campaign["cta"] = new_data.get("cta", campaign["cta"])
            campaign["captions"] = new_data.get("captions", campaign["captions"])
            if new_data.get("image_url"):
                campaign["image_url"] = new_data["image_url"]
            self._persist_campaign(link_id, campaign)
            return campaign
        return None


# Singleton instance
agency_bridge = AgencyBridge()
