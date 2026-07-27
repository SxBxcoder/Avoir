import asyncio
import json
from datetime import datetime
import random

class SignalDecayMonitor:
    """Monitors simulated campaign momentum and triggers decay alerts."""
    
    def __init__(self):
        """Initializes the monitor with mock campaign data."""
        # We simulate the 3 active campaigns from the frontend
        self.campaigns = [
            {"id": "pos-1", "platform": "TikTok", "momentum": 15.0},
            {"id": "pos-2", "platform": "Instagram", "momentum": 8.0},
            {"id": "pos-3", "platform": "YouTube Shorts", "momentum": -5.0},
        ]
        
    def tick(self):
        """
        Advances the simulation by one tick, updating momentum for all campaigns.
        Returns a list of event dictionaries suitable for SSE transmission.
        """
        events = []
        for camp in self.campaigns:
            if camp["id"] == "pos-1":
                # TikTok: trend up
                camp["momentum"] += random.uniform(-0.2, 0.8)
                camp["momentum"] = min(camp["momentum"], 45.0)
            elif camp["id"] == "pos-2":
                # Instagram: stable
                camp["momentum"] += random.uniform(-0.5, 0.5)
            elif camp["id"] == "pos-3":
                # YouTube Shorts: decay
                camp["momentum"] += random.uniform(-1.5, -0.2)
                camp["momentum"] = max(camp["momentum"], -25.0)
            else:
                camp["momentum"] += random.uniform(-1.5, 0.5)
                
            is_decay_alert = camp["momentum"] <= -10.0
            
            event_data = {
                "id": camp["id"],
                "platform": camp["platform"],
                "momentum": round(camp["momentum"], 2),
                "is_decay_alert": is_decay_alert,
                "timestamp": datetime.utcnow().isoformat()
            }
            events.append(event_data)
        
        return events

decay_monitor = SignalDecayMonitor()
