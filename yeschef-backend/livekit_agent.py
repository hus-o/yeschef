"""
YesChef LiveKit Agent
=====================
Real-time cooking assistant powered by Gemini 2.5 Flash native audio.
Runs as a separate process from the FastAPI server.

Usage:
  python livekit_agent.py dev          # local dev (auto-connects to LiveKit Cloud)
  python livekit_agent.py start        # production (Render Background Worker)
  python livekit_agent.py console      # interactive console mode

Requires env vars: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY
"""

import json
import logging
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AgentServer,
    JobContext,
    JobProcess,
    cli,
    room_io,
)
from livekit.plugins import google

load_dotenv()

logger = logging.getLogger("yeschef-agent")
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Agent Server
# ---------------------------------------------------------------------------
server = AgentServer()


def prewarm(proc: JobProcess):
    """Pre-load resources once per worker process for faster connections."""
    # Nothing heavy to preload for Gemini realtime — connection is per-session.
    # Placeholder for future VAD or model preloading if needed.
    proc.userdata["ready"] = True
    logger.info("YesChef agent process prewarmed")


server.setup_fnc = prewarm


# ---------------------------------------------------------------------------
# YesChef Agent
# ---------------------------------------------------------------------------
class YesChefAgent(Agent):
    """A warm, encouraging cooking assistant that guides users step-by-step."""

    def __init__(self, recipe_data: dict) -> None:
        title = recipe_data.get("title", "a delicious recipe")
        ingredients = recipe_data.get("ingredients", [])
        steps = recipe_data.get("steps", [])
        servings = recipe_data.get("servings", "")
        difficulty = recipe_data.get("difficulty", "")

        # Format ingredients for the prompt
        ingredients_text = ""
        if ingredients:
            for i, ing in enumerate(ingredients, 1):
                if isinstance(ing, dict):
                    name = ing.get("name", ing.get("item", ""))
                    amount = ing.get("amount", "")
                    unit = ing.get("unit", "")
                    ingredients_text += f"  {i}. {amount} {unit} {name}\n"
                else:
                    ingredients_text += f"  {i}. {ing}\n"

        # Format steps for the prompt
        steps_text = ""
        if steps:
            for i, step in enumerate(steps, 1):
                if isinstance(step, dict):
                    instruction = step.get("instruction", step.get("text", str(step)))
                    time_str = step.get("time", "")
                    time_note = f" ({time_str})" if time_str else ""
                    steps_text += f"  Step {i}: {instruction}{time_note}\n"
                else:
                    steps_text += f"  Step {i}: {step}\n"

        instructions = f"""You are YesChef, a warm, encouraging, and knowledgeable cooking assistant — like having a friendly Michelin-starred chef in the kitchen with you.

You are guiding the user through this recipe:

RECIPE: {title}
{f"Servings: {servings}" if servings else ""}
{f"Difficulty: {difficulty}" if difficulty else ""}

INGREDIENTS:
{ingredients_text if ingredients_text else "  (No ingredient list available — ask the user what they have!)"}

STEPS:
{steps_text if steps_text else "  (No step list available — help the user freestyle!)"}

YOUR PERSONALITY & RULES:
- Be conversational, warm, and encouraging — you LOVE cooking and you love helping people cook
- Start by briefly introducing the recipe and asking if they have all the ingredients ready
- Guide ONE step at a time — never rush ahead or dump multiple steps at once
- When the user says "next", "done", "what's next", or similar — move to the next step
- When moving to a new step, briefly state the step number (e.g., "Alright, step 3!")
- Offer quick tips, substitutions, or technique explanations when relevant
- Keep responses concise — 2-3 sentences max — this is AUDIO, not a textbook
- Use the phrase "Yes, Chef!" enthusiastically when the user completes a step
- Track which step the user is on and reference step numbers
- Proactively mention timing (e.g., "This needs about 5 minutes — I'll keep chatting with you while we wait")
- If the user asks about substitutions, dietary changes, or techniques, answer helpfully
- If the user seems confused or frustrated, be extra encouraging
- If asked something unrelated to cooking, briefly answer but gently steer back to the recipe
- NEVER say you're an AI or a language model — you're YesChef, their kitchen companion
- End the session warmly when they finish the last step — congratulate them!

CAMERA / VIDEO:
- The user can share their camera with you by tapping the camera button
- You can OCCASIONALLY ask the user to show you something by saying "Can you show me that? Tap the camera button so I can take a look"
- Good moments to ask: checking colour/doneness of meat, whether onions are caramelised enough, if dough has the right consistency, confirming a knife cut size, checking if oil is hot enough
- When you receive video, give specific visual feedback: comment on colour, texture, size, doneness — be genuinely helpful
- Do NOT ask for camera every step — only when visual confirmation would genuinely help (maybe 2-3 times per recipe)
- If the user shows you something without being asked, respond helpfully about what you see"""

        super().__init__(instructions=instructions)
        self._recipe_data = recipe_data
        self._title = title


# ---------------------------------------------------------------------------
# Session Entrypoint
# ---------------------------------------------------------------------------
@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """Called when a new participant joins a cook-* room."""
    ctx.log_context_fields = {"room": ctx.room.name}

    # Parse recipe context from room metadata (set by POST /live/token)
    # NOTE: ctx.job.room is the protobuf snapshot from dispatch — available immediately.
    # ctx.room is the RTC Room object which is empty until connect() is called.
    recipe_data = {}
    room_metadata = ctx.job.room.metadata if ctx.job and ctx.job.room else ""
    if room_metadata:
        try:
            recipe_data = json.loads(room_metadata)
            logger.info(
                f"Loaded recipe from room metadata: {recipe_data.get('title', 'unknown')}"
            )
        except json.JSONDecodeError:
            logger.warning("Could not parse room metadata as JSON")
    else:
        logger.warning("No room metadata found — agent will freestyle")

    title = recipe_data.get("title", "something delicious")
    resume_from_step = recipe_data.get("resume_from_step")  # None or int (1-indexed)

    # Configure Gemini 2.5 Flash native audio for real-time voice
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-09-2025",
            voice="Aoede",  # warm, friendly voice
            temperature=0.8,
            enable_affective_dialog=True,
            proactivity=True,
        ),
    )

    # Start the session with our cooking agent
    await session.start(
        room=ctx.room,
        agent=YesChefAgent(recipe_data),
        room_options=room_io.RoomOptions(
            video_input=True,  # Allow user to show their cooking via camera
        ),
    )

    # Connect to the room
    await ctx.connect()

    # Send an initial greeting to kick things off
    if resume_from_step:
        await session.generate_reply(
            instructions=f"Welcome the user back! They paused while cooking {title} and are resuming at step {resume_from_step}. Briefly remind them what step {resume_from_step} is about and ask if they're ready to continue. Keep it warm and brief — 2 sentences max."
        )
    else:
        await session.generate_reply(
            instructions=f"Greet the user warmly. Tell them you're YesChef and you're excited to help them make {title}. Ask if they have their ingredients ready. Keep it brief and energetic — 2 sentences max."
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cli.run_app(server)
