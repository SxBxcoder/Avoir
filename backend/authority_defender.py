import os
import time
import json
import uuid
import asyncio
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime
import random

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

class AuthorityDefender:
    """
    Agentic Social Listening Engine.
    Handles real Meta (Facebook/Instagram) Webhooks.
    Analyzes sentiment and autonomously drafts God-Tier brand replies.
    """
    def __init__(self):
        self.verify_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "avoir_authority_secret_2026")
        
        # In-memory queue to stream caught engagements to the frontend
        # In production, this goes to Redis or DynamoDB
        self.recent_engagements: List[Dict[str, Any]] = []
        
    def verify_webhook(self, mode: str, token: str, challenge: str) -> Optional[str]:
        """
        Meta Webhook Verification (hub.challenge)
        """
        if mode == "subscribe" and token == self.verify_token:
            print("🛡️ Authority Defender: Meta Webhook Verified!")
            return challenge
        return None

    async def process_webhook_payload(self, payload: Dict[str, Any]):
        """
        Parses the incoming Meta webhook payload, extracts comments,
        and triggers the agentic response drafter.
        """
        try:
            entries = payload.get("entry", [])
            for entry in entries:
                changes = entry.get("changes", [])
                for change in changes:
                    value = change.get("value", {})
                    
                    # Ensure it's a comment
                    item_type = value.get("item")
                    if item_type == "comment":
                        comment_id = value.get("comment_id")
                        text = value.get("text", "")
                        username = value.get("from", {}).get("username", "Unknown User")
                        post_id = value.get("media_id", "Unknown Post")
                        
                        print(f"🛡️ Authority Defender Caught Comment: @{username}: {text}")
                        
                        # Process autonomously in the background
                        asyncio.create_task(self.analyze_and_draft_reply(
                            comment_id=comment_id,
                            username=username,
                            text=text,
                            post_id=post_id
                        ))
        except Exception as e:
            print(f"❌ Webhook Parsing Error: {str(e)}")

    async def analyze_and_draft_reply(self, comment_id: str, username: str, text: str, post_id: str):
        """
        Uses the Diamond Cascade AI to classify sentiment and draft a reply.
        """
        # Define the PR Agent Persona prompt
        system_prompt = (
            "You are the Authority Defender, a God-Tier PR and Social Media Manager for a modern brand. "
            "You are analyzing an incoming social media comment. "
            "1. Classify the sentiment exactly as one of: [POSITIVE, NEGATIVE, QUESTION, TROLL]. "
            "2. Draft a witty, engaging, brand-aligned reply. If it's a troll, use clever, polite brand-judo to shut them down or flip it. "
            "Respond ONLY in valid JSON format: {\"sentiment\": \"<SENTIMENT>\", \"drafted_reply\": \"<YOUR_REPLY>\"}"
        )
        
        user_prompt = f"Comment from @{username}: \"{text}\""
        
        # For demo purposes, since we don't have LLM keys yet, we use an intelligent mock router
        try:
            if not GEMINI_API_KEY:
                # Mock Fallback if no key
                text_lower = text.lower()
                if any(word in text_lower for word in ["fake", "bot", "troll", "trash", "useless"]):
                    sentiment = "TROLL"
                    reply = f"@{username} We prefer 'AI Pioneers', but we appreciate the engagement! 🚀"
                elif any(word in text_lower for word in ["how much", "cost", "price", "?", "where"]):
                    sentiment = "QUESTION"
                    reply = f"Hi @{username}! Check our bio link for all the details. We have a free tier to get you started! ✨"
                elif any(word in text_lower for word in ["love", "fire", "insane", "amazing", "good"]):
                    sentiment = "POSITIVE"
                    reply = f"Thanks @{username}! Glad you're enjoying the future of creation. 🔥"
                else:
                    sentiment = "POSITIVE"
                    reply = f"Hey @{username}, thanks for dropping by! 🙌"
            else:
                # REAL GEMINI AI INTEGRATION
                print(f"[AuthorityDefender] 🎯 Firing Gemini AI for comment: {text}")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                
                payload = {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "generationConfig": {
                        "temperature": 0.7,
                        "responseMimeType": "application/json"
                    }
                }
                resp = requests.post(url, json=payload, timeout=10)
                resp.raise_for_status()
                data = resp.json()
                raw_text = data['candidates'][0]['content']['parts'][0]['text']
                
                parsed = json.loads(raw_text)
                sentiment = parsed.get("sentiment", "UNKNOWN")
                reply = parsed.get("drafted_reply", f"Thanks for the comment, @{username}!")
                print(f"[AuthorityDefender] ✅ AI Analysis complete: {sentiment}")

        except Exception as e:
            print(f"❌ AI Drafting Error: {str(e)}")
            sentiment = "UNKNOWN"
            reply = f"We appreciate your comment, @{username}!"

        # Create the engagement record
        engagement = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "username": username,
            "comment": text,
            "sentiment": sentiment,
            "ai_reply": reply,
            "status": "DRAFTED" # Waiting for human approval to post back to Meta API
        }
        
        # Add to stream queue
        self.recent_engagements.insert(0, engagement)
        
        # Keep queue bounded
        if len(self.recent_engagements) > 50:
            self.recent_engagements.pop()

    def get_latest_engagements(self) -> List[Dict[str, Any]]:
        """Returns the current queue and clears it (for basic polling/SSE)"""
        # For an SSE stream, we could yield these as they arrive.
        # For simplicity in FastAPI, we'll let the endpoint fetch them.
        engagements = list(self.recent_engagements)
        self.recent_engagements.clear()
        return engagements

# Singleton instance
defender = AuthorityDefender()
