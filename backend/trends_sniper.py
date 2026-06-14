import os
import requests
import time
import random
import json
from typing import List, Dict, Any

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

class TrendSniper:
    def __init__(self):
        # We check for keys but default to None if not present
        self.youtube_api_key = os.environ.get("YOUTUBE_API_KEY")
        self.apify_api_token = os.environ.get("APIFY_API_TOKEN")

    def get_current_trends(self) -> List[Dict[str, Any]]:
        """
        Main entry point to get all trends. It tries real APIs first,
        and falls back to God-Tier mocks if keys are missing.
        """
        trends = []
        
        # 1. Try YouTube
        if self.youtube_api_key:
            try:
                trends.extend(self._fetch_youtube_trends())
            except Exception as e:
                print(f"YouTube Snipe Failed: {e}")
                
        # 2. Try TikTok/Insta via Apify
        if self.apify_api_token:
            try:
                trends.extend(self._fetch_apify_tiktok_trends())
            except Exception as e:
                print(f"Apify Snipe Failed: {e}")

        # 3. Fallback to Gemini AI if we got nothing (Keys missing or failed)
        if not trends:
            trends = self._generate_ai_trends()
            
        # If Gemini also fails (no API key), use the Titanium Shield Mock
        if not trends:
            trends = self._get_smart_mock_trends()
            
        # Shuffle slightly to make it feel dynamic
        random.shuffle(trends)
        return trends[:5] # Return top 5 trends

    def _fetch_youtube_trends(self) -> List[Dict[str, Any]]:
        """Hits the real YouTube Data API v3 for trending shorts/videos."""
        url = "https://youtube.googleapis.com/youtube/v3/videos"
        params = {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": "US", # or "IN" based on global pivot
            "videoCategoryId": "20", # Gaming/Entertainment
            "maxResults": 3,
            "key": self.youtube_api_key
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        real_trends = []
        for item in data.get("items", []):
            real_trends.append({
                "id": f"yt_{item['id']}",
                "platform": "YouTube",
                "trend_name": item["snippet"]["title"],
                "description": item["snippet"]["description"][:150] + "...",
                "velocity": "High",
                "virality_score": min(99, int(item["statistics"].get("viewCount", 0)) // 100000),
                "audio_url": None,
                "suggested_hook": f"Secret to {item['snippet']['title']}..."
            })
        return real_trends

    def _fetch_apify_tiktok_trends(self) -> List[Dict[str, Any]]:
        """Skeleton for Apify TikTok/Insta Scraper."""
        # This requires setting up an Actor on Apify (e.g., clockworks/tiktok-scraper)
        # Using a mock return for now, but wired for real integration.
        return []

    def _generate_ai_trends(self) -> List[Dict[str, Any]]:
        """
        Dynamically generates real-time looking trends using Gemini.
        This represents the 'Proactive Autonomous' upgrade.
        """
        if not GEMINI_API_KEY:
            return []

        print("[TrendSniper] 🎯 Firing Gemini AI for dynamic trend detection...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        system_prompt = """You are an elite Social Media Trend Analyst. Return 3 highly viral, currently trending social media content formats.
Return valid JSON only. Format:
[
  {
    "id": "unique_id",
    "platform": "TikTok/Reels" | "YouTube Shorts",
    "trend_name": "Name of the trend",
    "description": "Why it works and what the visual format is",
    "velocity": "Spiking/Breaking/Sustained",
    "virality_score": 90-99,
    "suggested_hook": "A viral hook for this trend",
    "mutator_tags": ["tag1", "tag2", "tag3"]
  }
]"""
        try:
            payload = {
                "contents": [{"parts": [{"text": "Analyze the current global social media landscape and return 3 viral trends."}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {
                    "temperature": 0.9,
                    "responseMimeType": "application/json"
                }
            }
            resp = requests.post(url, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data['candidates'][0]['content']['parts'][0]['text']
            
            trends = json.loads(raw_text)
            
            # Ensure they have required fields
            for t in trends:
                if 'audio_url' not in t:
                    t['audio_url'] = None
            
            print(f"[TrendSniper] ✅ Gemini generated {len(trends)} dynamic trends.")
            return trends
        except Exception as e:
            print(f"[TrendSniper] ⚠️ AI Trend Generation failed: {e}")
            return []

    def _get_smart_mock_trends(self) -> List[Dict[str, Any]]:
        """
        Titanium Shield: Ultimate fallback if even AI keys are missing.
        """
        return [
            {
                "id": f"trend_{int(time.time())}_1",
                "platform": "TikTok/Reels",
                "trend_name": "POV: Main Character Energy Transition",
                "description": "Fast-paced camera whip transition with heavily bass-boosted phonk music.",
                "velocity": "Spiking (+400% in 12h)",
                "virality_score": 98,
                "audio_url": None,
                "suggested_hook": "POV: You finally stopped playing it safe...",
                "mutator_tags": ["aesthetic", "fast-cut", "phonk"]
            },
            {
                "id": f"trend_{int(time.time())}_2",
                "platform": "YouTube Shorts",
                "trend_name": "The 'Hormozi Pattern Interrupt' Explainer",
                "description": "Talking head format starting with an aggressive contrarian statement.",
                "velocity": "Sustained (+120% in 48h)",
                "virality_score": 92,
                "audio_url": None,
                "suggested_hook": "99% of people are doing [X] completely wrong.",
                "mutator_tags": ["talking-head", "educational", "retention"]
            }
        ]

# Instantiate singleton
sniper = TrendSniper()
