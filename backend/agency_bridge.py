import uuid
import time
import json
import os
from typing import Dict, List, Any, Optional

DATA_FILE = "agency_data.json"

class AgencyBridge:
    """
    Agency Bridge (B2B Multi-tenant module)
    File-backed store for shared campaigns and client feedback threads.
    In production, this maps to DynamoDB.
    """
    def __init__(self):
        self.clients = [
            {"id": "client_1", "name": "Nike India", "industry": "Apparel", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg"},
            {"id": "client_2", "name": "Starbucks Reserve", "industry": "F&B", "logo": "https://upload.wikimedia.org/wikipedia/en/d/d3/Starbucks_Corporation_Logo_2011.svg"},
            {"id": "client_3", "name": "Local Gym Co.", "industry": "Fitness", "logo": None}
        ]
        self.shared_campaigns: Dict[str, Dict[str, Any]] = {}
        self._load_data()

    def _load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r') as f:
                    self.shared_campaigns = json.load(f)
            except Exception as e:
                print(f"Error loading agency data: {e}")
                self.shared_campaigns = {}

    def _save_data(self):
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(self.shared_campaigns, f, indent=2)
        except Exception as e:
            print(f"Error saving agency data: {e}")

    def get_clients(self, agency_id: str = "default_agency") -> List[Dict[str, Any]]:
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
            "thread": []  # List of dicts: {"sender": "client"|"avoir", "text": "...", "timestamp": 123}
        }
        
        self.shared_campaigns[link_id] = public_data
        self._save_data()
        
        return f"/client-approval/{link_id}"

    def get_shared_campaign(self, link_id: str) -> Optional[Dict[str, Any]]:
        return self.shared_campaigns.get(link_id)

    def add_feedback(self, link_id: str, text: str, sender: str = "client") -> Optional[Dict[str, Any]]:
        """Add a comment to the thread."""
        campaign = self.shared_campaigns.get(link_id)
        if campaign:
            if "thread" not in campaign:
                campaign["thread"] = []
            campaign["thread"].append({
                "sender": sender,
                "text": text,
                "timestamp": int(time.time())
            })
            self._save_data()
            return campaign
        return None

    def update_campaign_variant(self, link_id: str, new_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update the campaign with the newly revised data from the AI."""
        campaign = self.shared_campaigns.get(link_id)
        if campaign:
            campaign["hook"] = new_data.get("hook", campaign["hook"])
            campaign["offer"] = new_data.get("offer", campaign["offer"])
            campaign["cta"] = new_data.get("cta", campaign["cta"])
            campaign["captions"] = new_data.get("captions", campaign["captions"])
            if new_data.get("image_url"):
                campaign["image_url"] = new_data["image_url"]
            self._save_data()
            return campaign
        return None

# Singleton instance
agency_bridge = AgencyBridge()
