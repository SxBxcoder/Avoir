import asyncio
import json
from datetime import datetime
import random

class SignalDecayMonitor:
    def __init__(self):
        # We simulate the 3 active campaigns from the frontend
        self.campaigns = [
            {"id": "pos-1", "platform": "TikTok", "momentum": 15.0},
            {"id": "pos-2", "platform": "Instagram", "momentum": 8.0},
            {"id": "pos-3", "platform": "YouTube Shorts", "momentum": -5.0},
        ]
        
    async def event_generator(self):
        """Async generator for Server-Sent Events (SSE)."""
        while True:
            await asyncio.sleep(2) # Send update every 2 seconds
            
            for camp in self.campaigns:
                # Randomly fluctuate momentum, with a downward bias to simulate decay
                camp["momentum"] += random.uniform(-1.5, 0.5)
                
                # If momentum drops below -10, trigger a decay alert
                is_decay_alert = camp["momentum"] <= -10.0
                
                event_data = {
                    "id": camp["id"],
                    "platform": camp["platform"],
                    "momentum": round(camp["momentum"], 2),
                    "is_decay_alert": is_decay_alert,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                yield f"data: {json.dumps(event_data)}\n\n"

decay_monitor = SignalDecayMonitor()
