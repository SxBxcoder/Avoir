"""
Avoir - FastAPI Development Server
Local web server for testing the Creative Director Agent
"""

# CRITICAL: Load .env file FIRST before any imports that use AWS
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import uvicorn

# Import the Lambda handler from agent.py
from aws_lambda_handler import lambda_handler
from trends_sniper import sniper
from shadow_clone import clone_engine
from authority_defender import defender
from agency_bridge import agency_bridge

# Initialize FastAPI app
app = FastAPI(
    title="Avoir API",
    description="AI Creative Director for Modern Brands",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Backup port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class CampaignRequest(BaseModel):
    goal: str
    user_id: str

    class Config:
        json_schema_extra = {
            "example": {
                "goal": "Hype my college tech fest",
                "user_id": "test_user_123"
            }
        }


class CampaignResponse(BaseModel):
    campaign_id: str
    user_id: str
    goal: str
    plan: dict
    captions: list[str]
    image_url: str
    status: str
    created_at: str


# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Avoir Creative Director",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "agent": "operational",
        "endpoints": ["/api/generate"]
    }


# Main campaign generation endpoint
@app.post("/api/generate", response_model=CampaignResponse)
async def generate_campaign(request: CampaignRequest):
    """
    Generate a complete social media campaign using the Creative Director Agent.
    
    Args:
        request: CampaignRequest with goal and user_id
    
    Returns:
        CampaignResponse with generated campaign details
    
    Raises:
        HTTPException: If campaign generation fails
    """
    try:
        # Prepare event for Lambda handler
        event = {
            "body": json.dumps({
                "goal": request.goal,
                "user_id": request.user_id
            })
        }
        
        # Create a mock context
        class MockContext:
            aws_request_id = "local-dev-request-" + request.user_id
            
        # Call the Lambda handler
        response = lambda_handler(event, context=MockContext())
        
        # Parse response
        status_code = response.get('statusCode', 500)
        body = json.loads(response.get('body', '{}'))
        
        # DEBUG: Verify response structure
        print(f"\n{'='*60}")
        print(f"DEBUG - Lambda Response Status: {status_code}")
        print(f"DEBUG - Lambda Response Body Keys: {body.keys()}")
        print(f"DEBUG - Plan present: {'plan' in body}")
        print(f"DEBUG - Captions present: {'captions' in body}")
        print(f"DEBUG - Image URL present: {'image_url' in body}")
        print(f"{'='*60}\n")
        
        # With total failover, lambda_handler always returns 200
        # But we still validate the response structure
        if status_code != 200:
            # This should rarely happen now, but keep as safety net
            error_message = body.get('error', 'Campaign generation failed')
            error_details = body.get('details', 'Unknown error')
            raise HTTPException(
                status_code=status_code,
                detail=f"{error_message}: {error_details}"
            )
        
        # Validate required keys (should always be present with total failover)
        required_keys = ['plan', 'captions', 'image_url']
        missing_keys = [key for key in required_keys if key not in body]
        if missing_keys:
            print(f"⚠️ WARNING: Missing keys in response: {missing_keys}")
            print(f"   This should not happen with total failover enabled!")
            # Add defaults as safety net
            if 'plan' not in body:
                body['plan'] = {'hook': 'Campaign ready!', 'offer': 'Special offer', 'cta': 'Join now'}
            if 'captions' not in body:
                body['captions'] = ['🔥 Caption 1', '✨ Caption 2', '💥 Caption 3']
            if 'image_url' not in body:
                body['image_url'] = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1024&h=1024&fit=crop'
                
        # Map DynamoDB keys to expected snake_case response
        if 'campaignId' in body and 'campaign_id' not in body:
            body['campaign_id'] = body.pop('campaignId')
        if 'userId' in body and 'user_id' not in body:
            body['user_id'] = body.pop('userId')
        
        # Return successful response directly (no extra wrappers)
        print(f"✅ Returning campaign to frontend")
        print(f"   Campaign ID: {body.get('campaign_id', 'N/A')}")
        print(f"   Status: {body.get('status', 'N/A')}")
        
        return CampaignResponse(**body)
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


# Optional: Get campaign history endpoint
@app.get("/api/campaigns/{user_id}")
async def get_campaigns(user_id: str):
    """
    Get campaign history for a user.
    
    Args:
        user_id: User identifier
    
    Returns:
        List of campaigns
    """
    # TODO: Implement DynamoDB query for campaign history
    return {
        "user_id": user_id,
        "campaigns": [],
        "message": "Campaign history endpoint - coming soon"
    }


# Sprint 3: Trend Sniper Endpoint
@app.get("/api/trends")
async def get_trends():
    """
    Scrapes the internet for current viral trends using the TrendSniper module.
    """
    try:
        trends = sniper.get_current_trends()
        return {"status": "success", "trends": trends}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to snipe trends: {str(e)}"
        )


# Sprint 8: Omni-Deck Command Center Publish Mock
class PublishRequest(BaseModel):
    campaign_id: str
    platforms: list[str]

@app.post("/api/publish")
async def publish_campaign(request: PublishRequest):
    """
    Zero-Click viral loop. Auto-publishes to selected platforms.
    """
    # MOCK implementation for local dev
    return {
        "status": "success",
        "message": f"Successfully published campaign {request.campaign_id} to {', '.join(request.platforms)}!",
        "metrics_url": "/dashboard/analytics"
    }


# Sprint 4: Shadow Clone Engine
class ShadowCloneRequest(BaseModel):
    script: str
    image_url: str

@app.post("/api/shadow-clone/generate")
async def generate_shadow_clone(request: ShadowCloneRequest):
    """
    Triggers the Zero-Camera Content Factory.
    Streams SSE updates back to the client as the avatar renders.
    """
    return StreamingResponse(
        clone_engine.generate_video_stream(request.script, request.image_url),
        media_type="text/event-stream"
    )


# Sprint 5: Authority Defender (Meta Webhooks & Live Engagement)

@app.get("/api/webhooks/meta")
async def verify_meta_webhook(request: Request):
    """
    Handles Meta webhook verification (hub.challenge)
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode and token:
        valid_challenge = defender.verify_webhook(mode, token, challenge)
        if valid_challenge:
            return PlainTextResponse(content=valid_challenge, status_code=200)
    
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/api/webhooks/meta")
async def receive_meta_webhook(request: Request):
    """
    Receives incoming webhook payloads from Meta (e.g., new comments).
    Passes them to the Authority Defender for sentiment analysis and auto-reply.
    """
    try:
        payload = await request.json()
        # Process asynchronously in the background
        import asyncio
        asyncio.create_task(defender.process_webhook_payload(payload))
        return {"status": "EVENT_RECEIVED"}
    except Exception as e:
        print(f"Error receiving webhook: {e}")
        return {"status": "ERROR"}

@app.get("/api/engagement/stream")
async def stream_engagements():
    """
    Streams live engagements from the Authority Defender to the frontend.
    """
    async def event_generator():
        import asyncio
        while True:
            # Poll for new engagements
            engagements = defender.get_latest_engagements()
            if engagements:
                for engagement in engagements:
                    yield f"data: {json.dumps(engagement)}\n\n"
            # Wait a bit before polling again
            await asyncio.sleep(1.0)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Run server
@app.get("/api/agency/clients")
async def get_agency_clients(agency_id: str = "default_agency"):
    """Fetch all clients managed by the agency."""
    clients = agency_bridge.get_clients(agency_id)
    return {"clients": clients}


class ShareLinkRequest(BaseModel):
    agency_id: str = "default_agency"
    campaign_data: dict


@app.post("/api/agency/share-link")
async def generate_share_link(request: ShareLinkRequest):
    """Generate a white-labeled share link for a client."""
    link = agency_bridge.generate_share_link(request.agency_id, request.campaign_data)
    return {"share_url": link}


@app.get("/api/public/campaign/{link_id}")
async def get_public_campaign(link_id: str):
    """Public route for clients to view white-labeled campaign."""
    campaign = agency_bridge.get_shared_campaign(link_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or expired")
    return {"campaign": campaign}

if __name__ == "__main__":
    print("🚀 Starting Avoir Development Server...")
    print("📍 API will be available at: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("🔗 Frontend should connect to: http://localhost:8000/api/generate")
    print("\n✨ Ready to generate campaigns!\n")
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
