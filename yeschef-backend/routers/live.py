import os
import json
from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, HTTPException
from livekit.api import AccessToken, VideoGrants

from schemas import LiveTokenRequest, LiveTokenResponse, SessionSummaryResponse
from dependencies import get_supabase_client, get_gemini_client

router = APIRouter(prefix="/live", tags=["live"])

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")


@router.post("/token", response_model=LiveTokenResponse)
async def create_live_token(req: LiveTokenRequest):
    """
    Generate a LiveKit room token for a cook session.
    The LiveKit Agent (Phase 2) will auto-join the room and provide
    Gemini-powered voice guidance.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    supabase = get_supabase_client()

    # Fetch recipe to embed as room metadata
    res = supabase.table("recipes").select("*").eq("id", req.recipe_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe = res.data[0]

    # Create a unique room name
    room_name = f"cook-{req.recipe_id[:8]}-{uuid4().hex[:6]}"

    # Build room metadata (the LiveKit Agent reads this)
    room_metadata = json.dumps({
        "recipe_id": str(recipe["id"]),
        "title": recipe.get("title", ""),
        "description": recipe.get("description", ""),
        "ingredients": recipe.get("ingredients", []),
        "steps": recipe.get("steps", []),
        "servings": recipe.get("servings", ""),
        "difficulty": recipe.get("difficulty", ""),
    })

    # Generate participant token
    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(req.user_id)
    token.with_name(req.user_name)
    token.with_metadata(json.dumps({"role": "cook"}))
    token.with_grants(VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))

    # Create a cook_session record
    try:
        supabase.table("cook_sessions").insert({
            "recipe_id": req.recipe_id,
            "user_id": None,  # No auth in demo mode
        }).execute()
    except Exception as e:
        print(f"[Live] Failed to create cook_session record: {e}")
        # Non-fatal — session tracking is nice-to-have

    jwt_token = token.to_jwt()

    return LiveTokenResponse(
        token=jwt_token,
        room_name=room_name,
        livekit_url=LIVEKIT_URL.replace("wss://", "wss://").rstrip("/"),
    )


@router.post("/sessions/{session_id}/summary", response_model=SessionSummaryResponse)
async def generate_session_summary(session_id: str):
    """
    Use Gemini 3 to analyze a cook session transcript and generate a summary.
    Called when the user ends a cooking session.
    """
    supabase = get_supabase_client()
    gemini = get_gemini_client()

    # Fetch session
    res = supabase.table("cook_sessions").select("*").eq("id", session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = res.data[0]
    transcript = session.get("transcript", [])

    if not transcript:
        return SessionSummaryResponse(
            session_id=session_id,
            summary="No conversation recorded for this session.",
            duration_seconds=session.get("duration_seconds"),
        )

    # Fetch recipe for context
    recipe_res = supabase.table("recipes").select("title, steps").eq("id", session["recipe_id"]).execute()
    recipe_title = recipe_res.data[0]["title"] if recipe_res.data else "Unknown recipe"
    total_steps = len(recipe_res.data[0].get("steps", [])) if recipe_res.data else 0

    # Ask Gemini to summarize
    transcript_text = json.dumps(transcript)
    prompt = f"""Analyze this cooking session transcript for the recipe "{recipe_title}".

Transcript:
{transcript_text[:10000]}

Provide a brief, encouraging summary including:
1. How far they got in the recipe
2. Any notable moments or questions
3. Tips for next time
Keep it to 2-3 sentences, warm and encouraging tone."""

    response = gemini.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    summary = response.text or "Great cooking session!"

    # Update session with summary
    completed_steps = session.get("completed_steps", [])
    supabase.table("cook_sessions").update({
        "summary": summary,
        "ended_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).execute()

    return SessionSummaryResponse(
        session_id=session_id,
        summary=summary,
        duration_seconds=session.get("duration_seconds"),
        steps_completed=len(completed_steps) if completed_steps else None,
        total_steps=total_steps or None,
    )

