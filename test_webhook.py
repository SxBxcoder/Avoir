import requests
import time
import json
import random

WEBHOOK_URL = "http://localhost:8000/api/webhooks/meta"

# Simulated comments hitting the webhook
comments = [
    {"user": "fitness_freak99", "text": "This app is absolutely insane! I love it! 🔥", "type": "positive"},
    {"user": "hater_troll_01", "text": "Another useless AI product, touching grass is better.", "type": "negative"},
    {"user": "curious_george", "text": "How much does the Pro plan cost?", "type": "question"},
    {"user": "gym_bro", "text": "Bro the edit transitions on this video are clean af 💯", "type": "positive"},
    {"user": "spam_bot", "text": "DM @promote_it for 10k followers cheap!", "type": "troll"}
]

print("🛡️ Waiting 15 seconds for browser to load Omni-Deck...")
time.sleep(15)
print("🛡️ Simulating Meta Webhooks targeting Authority Defender...")

for comment in comments:
    payload = {
        "object": "instagram",
        "entry": [{
            "id": "1234567890",
            "time": int(time.time()),
            "changes": [{
                "field": "comments",
                "value": {
                    "item": "comment",
                    "comment_id": f"comment_{random.randint(1000, 9999)}",
                    "text": comment["text"],
                    "from": {"username": comment["user"], "id": "11111"},
                    "media_id": "post_9999"
                }
            }]
        }]
    }
    
    print(f"Firing payload for: @{comment['user']}")
    res = requests.post(WEBHOOK_URL, json=payload)
    print(f"Response: {res.status_code}")
    time.sleep(3)

print("✅ Finished firing test webhooks.")
