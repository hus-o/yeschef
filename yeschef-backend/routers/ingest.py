import os
import time
import traceback
import collections
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from uuid import uuid4, UUID
from datetime import datetime

from schemas import (
    JobStatus, ExtractionResult, ExtractRequest, RecipeResponse, RecipeListResponse,
)
from dependencies import get_supabase_client, get_gemini_client

router = APIRouter()

# ── Simple in-memory rate limiter (per-IP, resets on restart) ──
_rate_limit_window = 60  # seconds
_rate_limit_max = int(os.environ.get("EXTRACT_RATE_LIMIT", "5"))  # requests per window
_rate_log: dict[str, list[float]] = collections.defaultdict(list)

def _check_rate_limit(client_ip: str, label: str = "extract") -> None:
    """Raise 429 if client_ip exceeds rate limit."""
    now = time.time()
    key = f"{label}:{client_ip}"
    timestamps = _rate_log[key]
    # Prune old entries
    _rate_log[key] = [t for t in timestamps if now - t < _rate_limit_window]
    if len(_rate_log[key]) >= _rate_limit_max:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded — max {_rate_limit_max} requests per minute. Try again shortly.",
        )
    _rate_log[key].append(now)

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY")
SUPADATA_API_KEY = os.environ.get("SUPADATA_API_KEY")


# ── Helper: normalize ingredient units (Gemini can't be trusted) ──

# Map of disallowed/abbreviated units → correct values
UNIT_CONVERSIONS = {
    # Abbreviations → full words
    "tbsp": "tablespoon",
    "tbsps": "tablespoons",
    "tbs": "tablespoon",
    "tsp": "teaspoon",
    "tsps": "teaspoons",
    # Cups → ml (using quantity multiplier)
    "cup": "_cup_to_ml",
    "cups": "_cup_to_ml",
    # Informal → proper
    "pinch": "teaspoon",   # will also fix quantity to 1/4
    "dash": "teaspoon",    # will also fix quantity to 1/8
    "splash": "tablespoon",
    "drizzle": "tablespoon",
    "handful": "g",        # ~30g
    "bunch": "g",          # ~30g
    "package": "g",        # context-dependent, default 250g
    "squeeze": "tablespoon",
    "knob": "g",           # ~15g
}

# Fraction string → float for cup conversion
def _frac_to_float(q: str) -> float:
    """Convert fraction string like '1/2' or '1' to float."""
    q = q.strip()
    if not q:
        return 1.0
    try:
        if '/' in q:
            parts = q.split('/')
            return float(parts[0]) / float(parts[1])
        return float(q)
    except (ValueError, ZeroDivisionError):
        return 1.0

def normalize_ingredient(ingredient: dict) -> dict:
    """Post-process a single ingredient dict to fix units."""
    unit = ingredient.get("unit", "").strip().lower()
    quantity = ingredient.get("quantity", "").strip()

    if unit not in UNIT_CONVERSIONS:
        return ingredient  # Already a valid unit

    mapped = UNIT_CONVERSIONS[unit]

    if mapped == "_cup_to_ml":
        # Convert cups to ml: multiply quantity by 240
        ml_value = _frac_to_float(quantity) * 240
        ingredient["quantity"] = str(int(ml_value)) if ml_value == int(ml_value) else str(round(ml_value))
        ingredient["unit"] = "ml"
    elif unit == "pinch":
        ingredient["quantity"] = "1/4"
        ingredient["unit"] = "teaspoon"
    elif unit == "dash":
        ingredient["quantity"] = "1/8"
        ingredient["unit"] = "teaspoon"
    elif unit in ("handful", "bunch"):
        ingredient["quantity"] = str(int(_frac_to_float(quantity) * 30))
        ingredient["unit"] = "g"
    elif unit == "package":
        ingredient["quantity"] = str(int(_frac_to_float(quantity) * 250))
        ingredient["unit"] = "g"
    elif unit == "knob":
        ingredient["quantity"] = str(int(_frac_to_float(quantity) * 15))
        ingredient["unit"] = "g"
    else:
        ingredient["unit"] = mapped

    return ingredient

def normalize_all_ingredients(ingredients: list[dict]) -> list[dict]:
    """Post-process all ingredients to enforce clean units."""
    return [normalize_ingredient(i) for i in ingredients]



def _fix_broken_words(text: str) -> str:
    """Fix words with random single spaces inserted (common in TikTok/auto-generated transcripts).
    E.g., 'Hone y Butte r Chicke n' → 'Honey Butter Chicken'
    Strategy: if a single letter follows a multi-char word fragment, merge them.
    """
    if not text:
        return text
    words = text.split(' ')
    if len(words) <= 1:
        return text
    merged = []
    i = 0
    while i < len(words):
        word = words[i]
        # Look ahead: if next token is a single alpha letter, it's likely a broken suffix
        if i + 1 < len(words) and len(words[i + 1]) == 1 and words[i + 1].isalpha():
            # Merge: "Hone" + "y" → "Honey"
            combined = word + words[i + 1]
            merged.append(combined)
            i += 2
        else:
            merged.append(word)
            i += 1
    return ' '.join(merged)

def clean_transcript_artifacts(recipe_dict: dict) -> dict:
    """Clean up transcript spacing artifacts from all text fields in a recipe."""
    text_fields = ["title", "description", "cuisine"]
    for field in text_fields:
        if recipe_dict.get(field):
            recipe_dict[field] = _fix_broken_words(recipe_dict[field])

    # Clean ingredients
    for ing in recipe_dict.get("ingredients", []):
        for key in ("item", "notes", "unit"):
            if ing.get(key):
                ing[key] = _fix_broken_words(ing[key])

    # Clean steps
    for step in recipe_dict.get("steps", []):
        for key in ("instruction", "tip"):
            if step.get(key):
                step[key] = _fix_broken_words(step[key])

    return recipe_dict


# ── Helper: detect source platform ──

def detect_platform(url: str) -> str:
    """Detect the source platform from a URL."""
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    elif "tiktok.com" in url_lower:
        return "tiktok"
    elif "instagram.com" in url_lower:
        return "instagram"
    return "web"


# ── Helper: fetch content from URL ──

async def fetch_content(url: str, platform: str) -> tuple[str, str]:
    """
    Fetch text content from the given URL.
    Returns (content_text, raw_transcript_or_empty).
    """
    raw_transcript = ""

    if platform in ("youtube", "tiktok", "instagram"):
        # Use Supadata for video platforms
        from supadata import Supadata
        client = Supadata(api_key=SUPADATA_API_KEY)

        title = ""
        description = ""

        # Try metadata (non-fatal if fails)
        try:
            metadata = client.metadata(url=url)
            title = getattr(metadata, "title", "") or ""
            description = getattr(metadata, "description", "") or ""
        except Exception as e:
            print(f"[Supadata] Metadata fetch skipped: {e}")

        # Fetch transcript
        try:
            transcript_data = client.transcript(url=url, text=True)

            if hasattr(transcript_data, "content") and transcript_data.content:
                raw_transcript = transcript_data.content
            elif isinstance(transcript_data, str):
                raw_transcript = transcript_data
            else:
                raise ValueError(f"Unexpected transcript format: {type(transcript_data)}")
        except Exception as e:
            print(f"[Supadata] Transcript error: {e}")
            raise ValueError(f"Could not get transcript from {platform} URL: {e}") from e

        content = f"Source: {platform} video\nTitle: {title}\nDescription: {description}\nTranscript:\n{raw_transcript}"
        return content, raw_transcript

    else:
        # Firecrawl for general web pages
        from firecrawl import FirecrawlApp
        app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
        scrape_result = app.scrape(url, formats=["markdown"])
        content = scrape_result.markdown or ""
        if not content:
            raise ValueError("Firecrawl returned empty content for this URL.")
        return content, ""


# ── Background task: process ingestion ──

async def process_ingestion(job_id: str, url: str):
    """Background task that fetches content, extracts recipes via Gemini, and saves to Supabase."""
    supabase = get_supabase_client()
    gemini = get_gemini_client()

    try:
        # Update job to processing
        supabase.table("jobs").update({
            "status": "processing",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        platform = detect_platform(url)
        content, raw_transcript = await fetch_content(url, platform)

        if not content.strip():
            raise ValueError("No content extracted from source.")

        # Gemini extraction (using gemini-3-flash-preview for hackathon)
        prompt = f"""You are a Michelin-starred chef and culinary instructor helping a home cook.
Your job is to analyze the following content and extract ALL distinct recipes into a precise, professional format
that a regular home cook can confidently take to the grocery store and then execute in their kitchen.

If the content is NOT a recipe or cooking-related, set is_valid_content to False and explain why.
If it's a listicle or contains multiple recipes, extract each one separately.

═══ INGREDIENTS RULES ═══

You are writing a SHOPPING LIST and a PREP GUIDE in one. Every ingredient must be actionable for someone at a store.

1. PRECISE QUANTITIES: Never use vague amounts. Translate informal language using your professional knowledge:
   - "a package of pasta" → determine the right amount for the serving size (e.g., "200" g for 2 servings)
   - "a bunch of parsley" → "30" "g" (or "1" "oz")
   - "several cloves of garlic" → estimate the actual count based on the dish (e.g., "5" "cloves")
   - "a knob of butter" → "30" "g"
   - "a glug of olive oil" → "45" "ml"
   - "a handful of cheese" → "50" "g"

2. STANDARD UNITS — WRITTEN OUT IN FULL, NEVER ABBREVIATED:
   Allowed units: g, kg, ml, L, oz, lb, piece(s), clove(s), slice(s), sprig(s), can(s), tablespoon, teaspoon.
   NEVER use abbreviations like "tbsp", "tsp", "cup". Write "tablespoon" not "tbsp". Write "teaspoon" not "tsp".
   NEVER use "cup" — it is ambiguous (US cup ≠ metric cup). Convert to ml instead: 1 cup = 240 ml, 1/2 cup = 120 ml, 1/4 cup = 60 ml.
   NEVER use informal units like "package", "pot", "pinch", "splash", "drizzle", "squeeze", "dash", "bunch", "handful".
   Convert "pinch of salt" → "1/4" "teaspoon". Convert "splash of lemon" → "1" "tablespoon". Convert "1/2 cup olive oil" → "120" "ml".

3. SERVING-SIZE AWARENESS: Cross-reference all quantities against the serving count.
   If the recipe says it serves 4 but a quantity seems like it's for 2 (or 8), adjust accordingly.

4. OMIT ONLY WATER: This is universally available and not purchased.
   DO include salt, pepper, oil, butter, flour, sugar, and all other pantry staples — a new cook may not have these.

5. NOTES FIELD: Use the "notes" field ONLY for preparation instructions relevant BEFORE or DURING cooking:
   - Good: "finely diced", "room temperature", "skin-on, bone-in", "freshly grated"
   - Bad: Don't repeat the item name. Don't put shopping info here.

═══ STEPS RULES ═══

You are writing instructions for a home cook who may be a beginner. Each step must be clear enough to follow without the original video.

1. ONE ACTION PER STEP: Don't combine multiple distinct actions. "Chop the garlic and dice the onions" should be two steps.
   Exception: Truly simultaneous actions like "Season with salt and pepper" are fine as one step.

2. DURATION: Estimate realistic duration_minutes for every step. Include passive time (e.g., water boiling = 10 min).
   If unsure, estimate conservatively — better to overestimate than leave a beginner rushing.

3. TIPS: The "tip" field is for professional-grade advice that helps a home cook succeed:
   - Technique insights: "Keep the heat at medium-low — if the garlic turns dark brown, it's burnt and will taste bitter"
   - Sensory cues: "The onions are ready when they're translucent and smell sweet, about 8 minutes"
   - Common mistakes: "Don't overcrowd the pan or the chicken will steam instead of sear"
   - Pro shortcuts: "Reserve 240 ml of pasta water before draining — the starch helps the sauce cling"
   - Safety: "Let the oil shimmer before adding food — if it smokes, it's too hot, pull it off the heat"
   CRITICAL: A tip must NEVER reference a technique, trick, or method that is not fully explained in the "instruction" field of the SAME step.
   If the source video mentions a technique (e.g., "shake garlic in a container to peel"), either:
     (a) Include the full technique in the instruction, then the tip can add nuance, OR
     (b) Omit the technique entirely from both instruction and tip.
   The user has NOT watched the video — they only see your text. Never assume they have context you haven't provided.
   Only include a tip when you have genuinely useful advice. Set to null if no meaningful tip exists for that step.

4. LOGICAL ORDER: Steps should follow the most efficient kitchen workflow.
   Start prep work (chopping, measuring) before cooking unless the original recipe intentionally interleaves them.

═══ METADATA RULES ═══

- title: Clean, appetizing recipe name. Remove YouTube-isms like "BEST EVER" or "You Won't Believe..."
- description: 1-2 sentences describing the dish, its origin, and what makes it special. Write like a menu description.
- servings: Specific number (e.g., "4" not "4-6"). Pick the most likely yield.
- prep_time / cook_time / total_time: Format as "X min" or "X hours Y min". Be realistic for a home cook (add 20-30% to what a pro would take).
- difficulty: "easy" (under 30 min, basic techniques), "medium" (30-60 min or intermediate techniques), "hard" (60+ min or advanced techniques like tempering, emulsions, etc.)
- cuisine: Be specific — "Southern Italian" is better than "Italian" when you can tell.
- tags: Include dietary info (vegetarian, vegan, gluten-free, dairy-free), meal type (breakfast, lunch, dinner, snack, dessert), cooking method (baked, grilled, one-pot, stir-fry), and descriptors (quick, meal-prep, comfort-food, kid-friendly).
- confidence: 0.0-1.0 based on source quality. 0.9+ = clear recipe with explicit quantities. 0.5-0.8 = informal cooking video where you had to infer quantities. Below 0.5 = very vague, lots of guesswork.

Content:
IMPORTANT: The transcript below may contain words with broken spacing (e.g., "Hone y" instead of "Honey", "butte r" instead of "butter"). Correct all such errors in your output.
{content[:15000]}"""

        # Retry with exponential backoff (Gemini can be overloaded)
        max_retries = 4
        models_to_try = ["gemini-3-flash-preview", "gemini-2.0-flash"]
        last_error = None
        response = None

        for model_name in models_to_try:
            for attempt in range(max_retries):
                try:
                    response = gemini.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config={
                            "response_mime_type": "application/json",
                            "response_schema": ExtractionResult,
                        },
                    )
                    last_error = None
                    break  # Success
                except Exception as e:
                    last_error = e
                    if "503" in str(e) or "overloaded" in str(e).lower() or "UNAVAILABLE" in str(e):
                        wait = 2 ** attempt  # 1s, 2s, 4s, 8s
                        print(f"[Gemini] {model_name} attempt {attempt+1}/{max_retries} failed (503), retrying in {wait}s...")
                        time.sleep(wait)
                    else:
                        raise  # Non-retryable error
            if response is not None:
                print(f"[Gemini] Success with model: {model_name}")
                break  # Got a response, stop trying models
            else:
                print(f"[Gemini] All retries exhausted for {model_name}, trying next model...")

        if response is None:
            raise last_error or ValueError("All Gemini models failed")

        extraction: ExtractionResult = response.parsed

        if not extraction.is_valid_content or not extraction.recipes:
            supabase.table("jobs").update({
                "status": "failed",
                "error": extraction.rejection_reason or "No valid recipes found in content",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", job_id).execute()
            return

        # Save each recipe to Supabase
        recipe_ids = []
        for recipe in extraction.recipes:
            # Post-process ingredients to normalize units (Gemini doesn't reliably follow unit constraints)
            raw_ingredients = [i.model_dump() for i in recipe.ingredients]
            cleaned_ingredients = normalize_all_ingredients(raw_ingredients)
            cleaned_steps = [s.model_dump() for s in recipe.steps]

            # Build recipe data and clean transcript spacing artifacts
            data = {
                "source_url": url,
                "source_platform": platform,
                "title": recipe.title,
                "description": recipe.description,
                "ingredients": cleaned_ingredients,
                "steps": cleaned_steps,
                "servings": recipe.servings,
                "prep_time": recipe.prep_time,
                "cook_time": recipe.cook_time,
                "total_time": recipe.total_time,
                "difficulty": recipe.difficulty,
                "cuisine": recipe.cuisine,
                "tags": recipe.tags,
                "confidence": recipe.confidence,
                "raw_transcript": raw_transcript[:50000] if raw_transcript else None,
                "user_id": None,  # No auth in demo mode
            }
            # Fix broken words from transcript artifacts (e.g., "Hone y" → "Honey")
            data = clean_transcript_artifacts(data)
            res = supabase.table("recipes").insert(data).execute()
            if res.data:
                recipe_ids.append(res.data[0]["id"])

        # Mark job complete
        supabase.table("jobs").update({
            "status": "completed",
            "recipe_ids": recipe_ids,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        print(f"[Ingest] Job {job_id} completed — {len(recipe_ids)} recipe(s) extracted")

    except Exception as e:
        print(f"[Ingest] Job {job_id} failed: {e}")
        traceback.print_exc()
        supabase.table("jobs").update({
            "status": "failed",
            "error": str(e)[:500],
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()


# ══════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════

@router.post("/extract", response_model=JobStatus)
async def start_extraction(req: ExtractRequest, background_tasks: BackgroundTasks, request: Request):
    """
    Submit a URL for recipe extraction. Returns a job ID to poll.
    Supports: YouTube, TikTok, Instagram, and any web URL.
    Rate limited: 5 requests per minute per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip, "extract")

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    job_id = str(uuid4())
    supabase = get_supabase_client()

    # Create job record
    supabase.table("jobs").insert({
        "id": job_id,
        "source_url": url,
        "status": "pending",
        "recipe_ids": [],
    }).execute()

    # Kick off background processing
    background_tasks.add_task(process_ingestion, job_id, url)

    return JobStatus(id=UUID(job_id), source_url=url, status="pending")


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Poll job status. Returns recipe_ids when completed."""
    supabase = get_supabase_client()
    res = supabase.table("jobs").select("*").eq("id", job_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = res.data[0]
    return JobStatus(
        id=UUID(job["id"]),
        source_url=job.get("source_url"),
        status=job["status"],
        recipe_ids=job.get("recipe_ids"),
        error=job.get("error"),
        created_at=job.get("created_at"),
    )


@router.get("/recipes", response_model=RecipeListResponse)
async def list_recipes(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List all recipes, newest first."""
    supabase = get_supabase_client()
    res = (
        supabase.table("recipes")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    recipes = [_db_row_to_recipe(r) for r in (res.data or [])]

    # Get total count
    count_res = supabase.table("recipes").select("id", count="exact").execute()
    total = count_res.count if hasattr(count_res, "count") and count_res.count else len(recipes)

    return RecipeListResponse(recipes=recipes, total=total)


@router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str):
    """Get a single recipe by ID."""
    supabase = get_supabase_client()
    res = supabase.table("recipes").select("*").eq("id", recipe_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return _db_row_to_recipe(res.data[0])


# ── Helper: convert DB row to RecipeResponse ──

def _db_row_to_recipe(row: dict) -> RecipeResponse:
    return RecipeResponse(
        id=str(row["id"]),
        title=row.get("title", ""),
        description=row.get("description"),
        source_url=row.get("source_url", ""),
        source_platform=row.get("source_platform"),
        thumbnail_url=row.get("thumbnail_url"),
        servings=row.get("servings"),
        prep_time=row.get("prep_time"),
        cook_time=row.get("cook_time"),
        total_time=row.get("total_time"),
        difficulty=row.get("difficulty"),
        cuisine=row.get("cuisine"),
        ingredients=row.get("ingredients", []),
        steps=row.get("steps", []),
        tags=row.get("tags"),
        confidence=row.get("confidence"),
        created_at=row.get("created_at"),
    )
