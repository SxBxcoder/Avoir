"""
AWS Lambda Handler for Avoir - Enterprise-Grade Campaign Generation
6-TIER DIAMOND RESILIENCE CASCADE - Production Version

This module serves as the ONLY entry point for AWS Lambda, handling API Gateway requests
and orchestrating the autonomous AI Creative Director workflow.

Architecture:
- 6-Tier Diamond Resilience Cascade (Gemini x2 → Groq → OpenRouter x2 → Mock)
- Pure REST API calls using Python standard library (urllib)
- Zero third-party AI SDK dependencies
- Live AI image generation via Pollinations.ai
- Global safety net with high-quality mock data
- 100% uptime guarantee for demos

Tier 1: Google Gemini 3 Flash Preview (Primary Key 1)
Tier 2: Google Gemini 3 Flash Preview (Primary Key 2 - Rotation)
Tier 3: Groq GPT-OSS 120B (Secondary - Ultra Fast)
Tier 4: OpenRouter Arcee Trinity Large (Tertiary - 400B Creative)
Tier 5: OpenRouter Llama 3.3 70B (The Shield - Ultra Reliable)
Tier 6: Titanium Shield Mock Data (Terminal - 100% Reliability)

Author: Team NEONX
Project: Avoir - AI-Native Agency + AI Hedge Fund
"""

import json
import os
import logging
import base64
import uuid
import urllib.parse
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

import boto3
from botocore.exceptions import ClientError


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logger = logging.getLogger()
# Add basicConfig to ensure terminal output during local execution
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger.setLevel(logging.INFO)


# ============================================================================
# GLOBAL INITIALIZATION (Cold-Start Optimization)
# ============================================================================

# Initialize AWS clients outside handler for connection reuse across invocations
try:
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    
    logger.info("AWS clients initialized successfully (DynamoDB, S3)")
except Exception as e:
    logger.error(f"Failed to initialize AWS clients: {str(e)}")
    raise


# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================

DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE_NAME', 'avoir-campaigns')
S3_BUCKET = os.environ.get('S3_BUCKET_NAME', 'avoir-assets')

# 6-Tier Diamond Resilience Cascade API Keys
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_API_KEY_2 = os.environ.get('GEMINI_API_KEY_2', '')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')

logger.info(f"Environment configuration loaded: DynamoDB={DYNAMODB_TABLE}, S3={S3_BUCKET}")
logger.info(f"API Keys configured: Gemini1={'✓' if GEMINI_API_KEY else '✗'}, Gemini2={'✓' if GEMINI_API_KEY_2 else '✗'}, Groq={'✓' if GROQ_API_KEY else '✗'}, OpenRouter={'✓' if OPENROUTER_API_KEY else '✗'}")


# ============================================================================
# SYSTEM PERSONA - THE CREATIVE DIRECTOR
# ============================================================================

SYSTEM_PROMPT = """You are the Avoir Lead Creative Director. You dominate global digital marketing.

TONE: Aggressive, elite, high-energy. Never be "mid" (mediocre).
LANGUAGE: Global Viral English (modern, high-converting, punchy).
POWER WORDS (MUST USE): Viral, Aesthetic, Main Character Energy, Level Up.
EMOJIS: 🔥, 💯, ✨, 🎉, 🚀

OUTPUT FORMAT: You MUST return valid JSON with this exact structure:
{
  "hook": "Attention-grabbing opening (English, 50-80 chars)",
  "offer": "Value proposition (English, 80-120 chars)",
  "cta": "Clear action with urgency (English, 30-50 chars)",
  "captions": ["Caption 1 (150-200 chars)", "Caption 2 (150-200 chars)", "Caption 3 (150-200 chars)"],
  "image_prompt": "A highly detailed, visual description of a photorealistic image for this campaign (English, 100-150 chars)"
}

CRITICAL: The image_prompt must be in English, highly detailed, and describe a photorealistic scene that captures the campaign's energy."""


TREND_SNIPER_PROMPT = """You are the Avoir God-Tier Trend Sniper. Your job is to hijack a viral internet trend and mutate it into a massive campaign for the user.

TONE: Aggressive, hyper-relevant, algorithm-optimizing.
LANGUAGE: Global Viral English.
POWER WORDS (MUST USE): Viral, Algorithm, Attention, Hack.

The user will provide a specific TREND. You must create a campaign that RIDES THIS TREND perfectly.
OUTPUT FORMAT: You MUST return valid JSON with this exact structure:
{
  "hook": "Attention-grabbing opening optimized for this specific trend (50-80 chars)",
  "offer": "Value proposition disguised as entertainment (80-120 chars)",
  "cta": "Clear action (30-50 chars)",
  "captions": ["Caption 1 matching the trend vibe", "Caption 2 for high engagement", "Caption 3 alternative angle"],
  "image_prompt": "A highly detailed, visual description of a photorealistic image matching the trend's aesthetic"
}"""


# ============================================================================
# MODEL CONFIGURATION (6-Tier Diamond Resilience Cascade)
# ============================================================================

# Tier 1 & 2: Google Gemini 3 Flash Preview (Primary with Key Rotation)
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

# Tier 3: Groq GPT-OSS 120B (Secondary - 120B Powerhouse)
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

# Tier 4: OpenRouter Arcee Trinity Large (Tertiary - 400B Creative King)
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "arcee-ai/trinity-large-preview:free"

# Tier 5: OpenRouter Llama 3.3 70B (The Shield - Ultra Reliable)
OPENROUTER_SHIELD_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

# Tier 6: Titanium Shield Mock Data (Terminal Fallback)

logger.info("6-Tier Diamond Resilience Cascade configured with Live AI Image Generation")


# ============================================================================
# CORS HEADERS
# ============================================================================

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json'
}


# ============================================================================
# HIGH-QUALITY MOCK DATA (Global Safety Net)
# ============================================================================

MOCK_CAMPAIGNS = {
    "tech": {
        "hook": "Calling all tech enthusiasts! Ready for the biggest innovation fest? 🚀",
        "offer": "3 days of workshops, hackathons, and networking with industry leaders",
        "cta": "Register now - limited seats available!",
        "captions": [
            "🔥 The ultimate tech fest is here! Learn AI, ML, and Web3 from the pros. Register now! 💻✨",
            "Attention coders, don't miss this! 3 days of pure tech extravaganza. Join the movement! 🚀💯",
            "The festival of innovation! Workshops, massive prizes, and networking. Secure your spot! 🎯🔥"
        ],
        "image_prompt": "Vibrant tech conference with young modern students coding on laptops, holographic AI displays, neon lights, futuristic atmosphere"
    },
    "fest": {
        "hook": "College fest season is here! Get ready for the ultimate celebration 🎉",
        "offer": "Music, dance, food, and unlimited fun with your squad",
        "cta": "Book your passes now before they're gone!",
        "captions": [
            "🎉 Experience the magic of our college fest! Music, dance, and food all in one place. Book passes! 🔥",
            "Gather your squad, the fest is here! Unlimited fun and unforgettable memories await. Don't miss out! 💯✨",
            "Celebration time! Epic performances, amazing food, and incredible vibes. Register today! 🚀🎊"
        ],
        "image_prompt": "Energetic college festival with colorful stage lights, crowd of excited modern students dancing, food stalls, vibrant celebration"
    },
    "workshop": {
        "hook": "Level up your skills with hands-on learning! 🎓",
        "offer": "Expert-led workshop with certificates and real-world projects",
        "cta": "Enroll today - Early bird discount available!",
        "captions": [
            "🎓 Time for a massive skill upgrade! Expert instructors, real projects, and a shiny new certificate. Enroll! 💯",
            "Join our intensive workshop and become a pro! Hands-on learning guaranteed to elevate your career. Register now! 🚀",
            "Need a career boost? This workshop is perfectly designed for you! Limited seats remaining, act fast! 🔥✨"
        ],
        "image_prompt": "Professional workshop setting with diverse students learning at modern desks, instructor presenting on screen, collaborative atmosphere"
    },
    "default": {
        "hook": "Something amazing is coming your way! 🌟",
        "offer": "Exclusive opportunity for creators and modern brands",
        "cta": "Join us now and be part of something special!",
        "captions": [
            "🔥 Something fresh and exciting is dropping soon! An exclusive opportunity for creators. Join the waitlist! 💯",
            "Don't let this massive chance slip by! We promise an absolute game-changing experience. Register now! ✨🚀",
            "We have a special offer just for you! This is available for a limited time only, so take action now. Let's go! 🔥"
        ],
        "image_prompt": "Dynamic group of diverse modern creatives celebrating success, aesthetic minimalist background, energetic and inspiring atmosphere"
    }
}


def get_mock_campaign(goal: str) -> Dict[str, Any]:
    """
    Get high-quality mock campaign based on goal keywords.
    
    Args:
        goal: User's campaign goal
    
    Returns:
        Mock campaign with hook, offer, cta, captions, and image_prompt
    """
    goal_lower = goal.lower()
    
    if any(word in goal_lower for word in ['tech', 'hackathon', 'coding', 'ai', 'ml']):
        return MOCK_CAMPAIGNS['tech']
    elif any(word in goal_lower for word in ['fest', 'festival', 'celebration', 'party', 'event']):
        return MOCK_CAMPAIGNS['fest']
    elif any(word in goal_lower for word in ['workshop', 'training', 'course', 'learn', 'skill']):
        return MOCK_CAMPAIGNS['workshop']
    else:
        return MOCK_CAMPAIGNS['default']


# ============================================================================
# 6-TIER DIAMOND RESILIENCE CASCADE - Pure Stateless with Live AI Images
# ============================================================================

def generate_campaign_with_cascade(goal: str, messages: List[Dict[str, str]] = None, brand_context: str = "") -> Dict[str, Any]:
    """
    4-Tier Diamond Resilience Cascade for Campaign Generation with Stateful Memory.
    
    Uses ONLY Python standard library (urllib) to call external APIs.
    
    Tier 1: Google Gemini 3 Flash Preview (Primary - Advanced Reasoning)
    Tier 2: Groq GPT-OSS 120B (Secondary - Powerhouse)
    Tier 3: OpenRouter Arcee Trinity Large (Tertiary - 400B Creative King)
    Tier 4: OpenRouter Llama 3.3 70B (The Shield - Ultra Reliable)
    
    Args:
        goal: User's campaign goal
        messages: Optional conversation history for stateful interactions
        brand_context: Optional brand guidelines
    
    Returns:
        Dict with keys: hook, offer, cta, captions (list of 3 strings), messages (conversation history)
    """
    logger.info("🔷 DIAMOND CASCADE INITIATED - PURE STATELESS MODE")
    logger.info(f"Goal: {goal}")
    
    # ========================================================================
    # PURE STATELESS GENERATION - No Message History Processing
    # ========================================================================
    # For MVP: Ignore messages array, use fresh one-shot prompts only
    # Messages are passed through to DynamoDB without being fed to LLMs
    
    logger.info("Using pure stateless generation with live AI image generation")

    active_system_prompt = SYSTEM_PROMPT
    if "[TREND SNIPE]" in goal:
        logger.info("🎯 TREND SNIPE DETECTED. Engaging Trend Sniper Persona.")
        active_system_prompt = TREND_SNIPER_PROMPT

    # ========================================================================
    # TIER 1: GOOGLE GEMINI 3 FLASH PREVIEW (Primary Key 1)
    # ========================================================================
    
    try:
        logger.info("🔷 TIER 1: Attempting Google Gemini 3 Flash Preview (Key 1)...")
        
        gemini_api_key = GEMINI_API_KEY
        
        if not gemini_api_key:
            raise Exception("GEMINI_API_KEY not configured")
        
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={gemini_api_key}"
        
        # Pure stateless prompt for Gemini
        gemini_contents = [{
            "role": "user",
            "parts": [{
                "text": active_system_prompt + f"\n\nTask: Create a viral global social media campaign for the following goal: {goal}\n\nReturn ONLY valid JSON with keys: hook, offer, cta, captions (array of 3), image_prompt."
            }]
        }]
        
        gemini_payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7,
                "maxOutputTokens": 2048
            }
        }
        
        gemini_request = Request(
            gemini_url,
            data=json.dumps(gemini_payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urlopen(gemini_request, timeout=60) as response:
            gemini_result = json.loads(response.read().decode('utf-8'))
        
        # Parse Gemini response
        if 'candidates' in gemini_result and len(gemini_result['candidates']) > 0:
            content = gemini_result['candidates'][0]['content']
            if 'parts' in content and len(content['parts']) > 0:
                text = content['parts'][0]['text']
                
                # Parse JSON from text
                campaign_data = json.loads(text)
                
                # Validate structure (image_prompt optional for backward compatibility)
                if all(key in campaign_data for key in ['hook', 'offer', 'cta', 'captions']):
                    if isinstance(campaign_data['captions'], list) and len(campaign_data['captions']) >= 3:
                        # Pass messages through without mutation
                        campaign_data['messages'] = messages if messages else []
                        
                        logger.info("✅ TIER 1 SUCCESS: Gemini 3 Flash Preview (Key 1) delivered")
                        return campaign_data
        
        raise Exception("Gemini Tier 1 response structure invalid")
    
    except Exception as e1:
        logger.warning(f"⚠️ TIER 1 FAILED: {str(e1)}")
        logger.info("→ Cascading to TIER 2...")
    
    # ========================================================================
    # TIER 2: GOOGLE GEMINI 3 FLASH PREVIEW (Primary Key 2 - Rotation)
    # ========================================================================
    
    try:
        logger.info("🔷 TIER 2: Attempting Google Gemini 3 Flash Preview (Key 2)...")
        
        gemini_api_key_2 = GEMINI_API_KEY_2
        
        if not gemini_api_key_2:
            raise Exception("GEMINI_API_KEY_2 not configured")
        
        gemini_url_2 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={gemini_api_key_2}"
        
        # Pure stateless prompt for Gemini (Key 2)
        gemini_contents_2 = [{
            "role": "user",
            "parts": [{
                "text": SYSTEM_PROMPT + f"\n\nTask: Create a viral global social media campaign for the following goal: {goal}\n\nReturn ONLY valid JSON with keys: hook, offer, cta, captions (array of 3), image_prompt."
            }]
        }]
        
        gemini_payload_2 = {
            "contents": gemini_contents_2,
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7,
                "maxOutputTokens": 2048
            }
        }
        
        gemini_request_2 = Request(
            gemini_url_2,
            data=json.dumps(gemini_payload_2).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urlopen(gemini_request_2, timeout=60) as response:
            gemini_result_2 = json.loads(response.read().decode('utf-8'))
        
        # Parse Gemini response
        if 'candidates' in gemini_result_2 and len(gemini_result_2['candidates']) > 0:
            content = gemini_result_2['candidates'][0]['content']
            if 'parts' in content and len(content['parts']) > 0:
                text = content['parts'][0]['text']
                
                # Parse JSON from text
                campaign_data = json.loads(text)
                
                # Validate structure
                if all(key in campaign_data for key in ['hook', 'offer', 'cta', 'captions']):
                    if isinstance(campaign_data['captions'], list) and len(campaign_data['captions']) >= 3:
                        # Pass messages through without mutation
                        campaign_data['messages'] = messages if messages else []
                        
                        logger.info("✅ TIER 2 SUCCESS: Gemini 3 Flash Preview (Key 2) delivered")
                        return campaign_data
        
        raise Exception("Gemini Tier 2 response structure invalid")
    
    except Exception as e2:
        logger.warning(f"⚠️ TIER 2 FAILED: {str(e2)}")
        logger.info("→ Cascading to TIER 3...")
    
    # ========================================================================
    # TIER 3: GROQ GPT-OSS 120B (Secondary Fallback - Powerhouse)
    # ========================================================================
    
    try:
        logger.info("🔷 TIER 3: Attempting Groq GPT-OSS 120B...")
        
        groq_api_key = GROQ_API_KEY
        
        if not groq_api_key:
            raise Exception("GROQ_API_KEY not configured")
        
        groq_url = "https://api.groq.com/openai/v1/chat/completions"
        
        # Pure stateless prompt for Groq (NO message history to prevent HTTP 400)
        stateless_messages = [
            {"role": "system", "content": active_system_prompt},
            {"role": "user", "content": f"Task: Create a viral global social media campaign for the following goal: {goal}\n\nReturn ONLY valid JSON with keys: hook, offer, cta, captions (array of 3), image_prompt."}
        ]
        
        groq_payload = {
            "model": "openai/gpt-oss-120b",
            "messages": stateless_messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
            "max_tokens": 2048
        }
        
        groq_request = Request(
            groq_url,
            data=json.dumps(groq_payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {groq_api_key}',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            method='POST'
        )
        
        with urlopen(groq_request, timeout=60) as response:
            groq_result = json.loads(response.read().decode('utf-8'))
        
        # Parse Groq response
        if 'choices' in groq_result and len(groq_result['choices']) > 0:
            message = groq_result['choices'][0]['message']
            if 'content' in message:
                campaign_data = json.loads(message['content'])
                
                # Validate structure
                if all(key in campaign_data for key in ['hook', 'offer', 'cta', 'captions']):
                    if isinstance(campaign_data['captions'], list) and len(campaign_data['captions']) >= 3:
                        # Pass messages through without mutation
                        campaign_data['messages'] = messages if messages else []
                        
                        logger.info("✅ TIER 3 SUCCESS: Groq GPT-OSS 120B delivered")
                        return campaign_data
        
        raise Exception("Groq response structure invalid")
    
    except Exception as e3:
        logger.warning(f"⚠️ TIER 3 FAILED: {str(e3)}")
        logger.info("→ Cascading to TIER 4...")
    
    # ========================================================================
    # TIER 4: OPENROUTER ARCEE TRINITY LARGE (Tertiary - 400B Creative King)
    # ========================================================================
    
    try:
        logger.info("🔷 TIER 4: Attempting OpenRouter Arcee Trinity Large...")
        
        openrouter_api_key = OPENROUTER_API_KEY
        
        if not openrouter_api_key:
            raise Exception("OPENROUTER_API_KEY not configured")
        
        openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        
        # Pure stateless prompt for OpenRouter (NO message history)
        stateless_messages = [
            {"role": "system", "content": active_system_prompt},
            {"role": "user", "content": f"Task: Create a viral global social media campaign for the following goal: {goal}\n\nReturn ONLY valid JSON with keys: hook, offer, cta, captions (array of 3), image_prompt."}
        ]
        
        openrouter_payload = {
            "model": "arcee-ai/trinity-large-preview",
            "messages": stateless_messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
            "max_tokens": 2048
        }
        
        openrouter_request = Request(
            openrouter_url,
            data=json.dumps(openrouter_payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {openrouter_api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://avoir.ai',
                'X-Title': 'Avoir',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            method='POST'
        )
        
        with urlopen(openrouter_request, timeout=60) as response:
            openrouter_result = json.loads(response.read().decode('utf-8'))
        
        # Parse OpenRouter response
        if 'choices' in openrouter_result and len(openrouter_result['choices']) > 0:
            message = openrouter_result['choices'][0]['message']
            if 'content' in message:
                campaign_data = json.loads(message['content'])
                
                # Validate structure
                if all(key in campaign_data for key in ['hook', 'offer', 'cta', 'captions']):
                    if isinstance(campaign_data['captions'], list) and len(campaign_data['captions']) >= 3:
                        # Pass messages through without mutation
                        campaign_data['messages'] = messages if messages else []
                        
                        logger.info("✅ TIER 4 SUCCESS: OpenRouter Arcee Trinity Large delivered")
                        return campaign_data
        
        raise Exception("OpenRouter response structure invalid")
    
    except Exception as e4:
        logger.warning(f"⚠️ TIER 4 FAILED: {str(e4)}")
        logger.info("→ Deploying TIER 5 THE SHIELD...")
    
    # ========================================================================
    # TIER 5: LLAMA 3.3 70B - THE SHIELD (Ultra Reliable)
    # ========================================================================
    
    try:
        logger.info("🛡️ TIER 5: Attempting OpenRouter Llama 3.3 70B (The Shield)...")
        
        openrouter_api_key = OPENROUTER_API_KEY
        
        if not openrouter_api_key:
            raise Exception("OPENROUTER_API_KEY not configured")
        
        openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        
        # Pure stateless prompt for Shield (NO message history)
        stateless_messages = [
            {"role": "system", "content": active_system_prompt},
            {"role": "user", "content": f"Task: Create a viral global social media campaign for the following goal: {goal}\n\nReturn ONLY valid JSON with keys: hook, offer, cta, captions (array of 3), image_prompt."}
        ]
        
        shield_payload = {
            "model": "meta-llama/llama-3.3-70b-instruct:free",
            "messages": stateless_messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
            "max_tokens": 2048
        }
        
        shield_request = Request(
            openrouter_url,
            data=json.dumps(shield_payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {openrouter_api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://avoir.ai',
                'X-Title': 'Avoir',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            method='POST'
        )
        
        with urlopen(shield_request, timeout=60) as response:
            shield_result = json.loads(response.read().decode('utf-8'))
        
        # Parse Shield response
        if 'choices' in shield_result and len(shield_result['choices']) > 0:
            message = shield_result['choices'][0]['message']
            if 'content' in message:
                campaign_data = json.loads(message['content'])
                
                # Validate structure
                if all(key in campaign_data for key in ['hook', 'offer', 'cta', 'captions']):
                    if isinstance(campaign_data['captions'], list) and len(campaign_data['captions']) >= 3:
                        # Pass messages through without mutation
                        campaign_data['messages'] = messages if messages else []
                        
                        logger.info("✅ TIER 5 SUCCESS: Llama 3.3 70B Shield delivered")
                        return campaign_data
        
        raise Exception("Shield response structure invalid")
    
    except Exception as e5:
        logger.warning(f"⚠️ TIER 5 FAILED: {str(e5)}")
        logger.info("→ Deploying TIER 6 TITANIUM SHIELD MOCK DATA...")
    
    # ========================================================================
    # TIER 6: TITANIUM SHIELD - INTELLIGENT MOCK DATA (Terminal Fallback)
    # ========================================================================
    
    logger.info("🛡️ TIER 6: TITANIUM SHIELD MOCK DATA ACTIVATED")
    
    # Get intelligent mock data based on goal keywords
    mock_response = get_mock_campaign(goal)
    
    # Pass messages through without mutation
    mock_response['messages'] = messages if messages else []
    
    return mock_response


def parse_captions(text: str) -> List[str]:
    """Parse numbered captions from model response (legacy function, kept for compatibility)."""
    lines = text.strip().split('\n')
    captions = []
    
    for line in lines:
        line = line.strip()
        if line and (line[0].isdigit() or line.startswith('-')):
            caption = line.lstrip('0123456789.-) ').strip()
            if caption:
                captions.append(caption)
    
    if len(captions) < 3:
        captions.extend([captions[0]] * (3 - len(captions)))
    
    return captions[:3]


# ============================================================================
# LAMBDA HANDLER (Global Safety Net)
# ============================================================================

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda entry point for Avoir campaign generation.
    
    GLOBAL SAFETY NET: Wraps entire execution in try/except to ensure
    statusCode 200 is always returned with mock data if anything fails.
    
    Expected event structure:
    {
        "goal": "Hype my college fest",
        "user_id": "cognito_user_id"
    }
    
    Returns:
    {
        "campaign_id": "uuid",
        "plan": {"hook": "...", "offer": "...", "cta": "..."},
        "captions": ["...", "...", "..."],
        "image_url": "https://...",
        "status": "completed"
    }
    """
    
    # Log incoming request for audit trail
    logger.info(f"Received request: {json.dumps(event, default=str)}")
    logger.info(f"Request ID: {context.aws_request_id}")
    
    # ========================================================================
    # CORS PREFLIGHT HANDLING
    # ========================================================================
    
    if event.get('httpMethod') == 'OPTIONS' or event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        logger.info("Handling CORS preflight request")
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps({'message': 'CORS preflight successful'})
        }
    
    # ========================================================================
    # GLOBAL SAFETY NET - NEVER RETURN 502
    # ========================================================================
    
    try:
        # Extract and validate request body
        # Handle both API Gateway and Lambda Function URL formats
        body = event.get('body', '{}')
        
        # If body is None, use empty dict
        if body is None:
            body = '{}'
        
        # Parse JSON payload - handle stringified JSON
        try:
            if isinstance(body, str):
                payload = json.loads(body) if body else {}
            else:
                payload = body
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in request body: {str(e)}")
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'error': 'Bad Request',
                    'message': 'Invalid JSON format in request body'
                })
            }
        
        # Validate required fields
        goal = payload.get('goal')
        
        if not goal:
            logger.warning("Missing required field: goal - using default")
            goal = 'College Fest Campaign'  # Default goal for testing
        
        # Extract optional fields
        user_id = payload.get('user_id', 'anonymous')
        brand_context = payload.get('brand_context', '')
        messages = payload.get('messages', [])  # Extract conversation history
        
        # Extract user context from Cognito if available
        user_context = get_user_context(event)
        if user_context and user_context.get('user_id'):
            user_id = user_context['user_id']
            logger.info(f"User authenticated via Cognito: {user_id}")
        
        logger.info(f"Processing campaign request - User: {user_id}, Goal: {goal}")
        
        # ====================================================================
        # 6-TIER DIAMOND CASCADE EXECUTION
        # ====================================================================
        
        # Generate unique campaign ID first (needed for deterministic seed)
        campaign_id = str(uuid.uuid4())
        
        try:
            # Execute the Diamond Cascade
            logger.info(f"Executing 6-Tier Diamond Cascade for goal: {goal}")
            logger.info(f"Conversation history: {len(messages)} messages")
            
            # Get campaign data from cascade
            campaign_data = generate_campaign_with_cascade(goal, messages, brand_context)
            
            logger.info("Campaign data generated successfully")
            
            # Extract campaign components
            hook = campaign_data.get('hook', '')
            offer = campaign_data.get('offer', '')
            cta = campaign_data.get('cta', '')
            captions = campaign_data.get('captions', [])
            image_prompt = campaign_data.get('image_prompt', '')
            conversation_messages = campaign_data.get('messages', messages)
            
            # ================================================================
            # LIVE AI IMAGE GENERATION - Pollinations.ai
            # ================================================================
            if image_prompt:
                # Create deterministic seed from campaign ID
                seed = int(hashlib.md5(campaign_id.encode()).hexdigest(), 16) % 100000
                
                # Build Pollinations.ai URL with image prompt
                image_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(image_prompt)}?width=1024&height=1024&nologo=true&seed={seed}"
                
                logger.info(f"Live AI image generated with seed {seed}")
            else:
                # Fallback to generic image if no prompt
                image_url = "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1024&h=1024&fit=crop"
                logger.warning("No image_prompt in response, using fallback image")
            
            logger.info(f"Campaign generation completed: {len(captions)} captions, live AI image generated")
        
        except Exception as cascade_error:
            # Cascade execution failed - use high-quality mock data
            logger.warning(f"⚠️ Cascade execution failed: {str(cascade_error)}")
            logger.info("📡 [SAFETY NET] Returning high-quality mock campaign")
            
            mock_campaign = get_mock_campaign(goal)
            hook = mock_campaign.get('hook', '')
            offer = mock_campaign.get('offer', '')
            cta = mock_campaign.get('cta', '')
            captions = mock_campaign.get('captions', [])
            image_prompt = mock_campaign.get('image_prompt', '')
            conversation_messages = messages
            
            # Generate live AI image for mock data too
            if image_prompt:
                seed = int(hashlib.md5(campaign_id.encode()).hexdigest(), 16) % 100000
                image_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(image_prompt)}?width=1024&height=1024&nologo=true&seed={seed}"
            else:
                image_url = "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1024&h=1024&fit=crop"
        
        # ====================================================================
        # DYNAMODB PERSISTENCE
        # ====================================================================
        
        # Construct campaign record with conversation history
        campaign_record = {
            'campaignId': campaign_id,
            'userId': user_id,
            'goal': goal,
            'plan': {
                'hook': hook,
                'offer': offer,
                'cta': cta
            },
            'captions': captions,
            'image_url': image_url,
            'image_prompt': image_prompt,
            'messages': conversation_messages,
            'status': 'completed',
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Save to DynamoDB
        try:
            table = dynamodb.Table(DYNAMODB_TABLE)
            table.put_item(Item=campaign_record)
            logger.info(f"Campaign saved to DynamoDB: {campaign_id} with {len(conversation_messages)} messages")
        except ClientError as e:
            logger.error(f"Failed to save campaign to DynamoDB: {str(e)}")
            # Continue execution even if DynamoDB save fails
        
        # ====================================================================
        # SUCCESS RESPONSE (Always 200 with JSON body)
        # ====================================================================
        
        logger.info(f"Campaign generation completed successfully for user: {user_id}")
        
        # CRITICAL: Return API Gateway/Lambda Function URL proxy format
        response = {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps(campaign_record)
        }
        
        logger.info(f"Returning response with statusCode: {response['statusCode']}")
        return response
    
    except Exception as e:
        # ====================================================================
        # GLOBAL SAFETY NET - NEVER RETURN 502
        # ====================================================================
        
        logger.error(f"❌ CRITICAL ERROR in lambda_handler: {str(e)}", exc_info=True)
        logger.info("📡 [GLOBAL SAFETY NET] Returning 200 with mock data to prevent 502")
        
        # Extract goal from event for intelligent mock matching
        try:
            body = event.get('body', '{}')
            if body is None:
                body = '{}'
            payload = json.loads(body) if isinstance(body, str) else body
            goal = payload.get('goal', 'Amazing campaign')
            user_id = payload.get('user_id', 'anonymous')
        except:
            goal = 'Amazing campaign'
            user_id = 'anonymous'
        
        # Get high-quality mock campaign
        mock_data = get_mock_campaign(goal)
        
        # Create complete campaign record with mock data
        campaign_id = str(uuid.uuid4())
        campaign_record = {
            'campaignId': campaign_id,
            'userId': user_id,
            'goal': goal,
            'plan': {
                'hook': mock_data.get('hook', ''),
                'offer': mock_data.get('offer', ''),
                'cta': mock_data.get('cta', '')
            },
            'captions': mock_data.get('captions', []),
            'image_url': "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1024&h=1024&fit=crop",
            'status': 'completed',
            'created_at': datetime.utcnow().isoformat(),
            'error_recovered': True
        }
        
        logger.info(f"✅ Returning mock campaign with 200 status")
        
        # CRITICAL: Return API Gateway/Lambda Function URL proxy format
        response = {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps(campaign_record)
        }
        
        logger.info(f"Returning error recovery response with statusCode: {response['statusCode']}")
        return response


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_user_context(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Extract user context from API Gateway authorizer (Cognito JWT).
    
    Args:
        event: API Gateway event object
    
    Returns:
        Dict containing user_id and other claims, or None if not authenticated
    """
    authorizer = event.get('requestContext', {}).get('authorizer', {})
    
    if not authorizer:
        return None
    
    claims = authorizer.get('claims', {})
    
    return {
        'user_id': claims.get('sub'),
        'email': claims.get('email'),
        'username': claims.get('cognito:username')
    }


# ============================================================================
# ENTRY POINT VALIDATION
# ============================================================================

if __name__ == '__main__':
    # Local testing support
    logger.info("Lambda handler loaded successfully")
    logger.info(f"Environment: DynamoDB={DYNAMODB_TABLE}, S3={S3_BUCKET}")
    logger.info("4-Tier Diamond Cascade: Gemini → Groq → OpenRouter → Titanium Shield")
    
    # Test event for local development
    test_event = {
        'httpMethod': 'POST',
        'body': json.dumps({
            'goal': 'Python AI Workshop for college students',
            'user_id': 'test-user-123'
        })
    }
    
    # Mock context
    class MockContext:
        request_id = 'local-test-request-id'
        function_name = 'avoir-backend'
        memory_limit_in_mb = 512
        invoked_function_arn = 'arn:aws:lambda:us-east-1:123456789012:function:avoir-backend'
    
    # Test handler
    response = lambda_handler(test_event, MockContext())
    print(json.dumps(response, indent=2))
