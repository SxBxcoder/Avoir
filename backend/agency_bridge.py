import uuid
import time
from typing import Dict, List, Any, Optional

class AgencyBridge:
    """
    Agency Bridge (B2B Multi-tenant module)
    Provides mock data for agency clients, and an in-memory store for shared campaigns.
    In production, this would map to a DynamoDB "AgencyClients" and "SharedLinks" table.
    """
    def __init__(self):
        # Mock Clients for the agency
        self.clients = [
            {"id": "client_1", "name": "Nike India", "industry": "Apparel", "logo": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg"},
            {"id": "client_2", "name": "Starbucks Reserve", "industry": "F&B", "logo": "https://upload.wikimedia.org/wikipedia/en/d/d3/Starbucks_Corporation_Logo_2011.svg"},
            {"id": "client_3", "name": "Local Gym Co.", "industry": "Fitness", "logo": None}
        ]
        
        # In-memory store for shared campaigns: link_id -> campaign_data
        self.shared_campaigns: Dict[str, Dict[str, Any]] = {}

    def get_clients(self, agency_id: str = "default_agency") -> List[Dict[str, Any]]:
        """Return the clients managed by this agency."""
        return self.clients

    def generate_share_link(self, agency_id: str, campaign_data: Dict[str, Any]) -> str:
        """
        Creates a public, white-labeled share link for a campaign.
        """
        link_id = str(uuid.uuid4())[:12] # shorter, clean URL
        
        # Strip internal messages or sensitive data before sharing
        public_data = {
            "hook": campaign_data.get("hook", ""),
            "offer": campaign_data.get("offer", ""),
            "cta": campaign_data.get("cta", ""),
            "captions": campaign_data.get("captions", []),
            "image_url": campaign_data.get("image_url", ""),
            "agency_id": agency_id,
            "created_at": int(time.time()),
            "status": "PENDING_APPROVAL"
        }
        
        self.shared_campaigns[link_id] = public_data
        
        # Return the public route
        return f"/client-approval/{link_id}"

    def get_shared_campaign(self, link_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a shared campaign by its unique link ID."""
        return self.shared_campaigns.get(link_id)

# Singleton instance
agency_bridge = AgencyBridge()
