import os
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import HttpUrl
from uuid import uuid4, UUID
from typing import Optional
import time

from schemas import JobStatus, ExtractionResult, RecipeData
from dependencies import get_supabase_client, get_gemini_client
from supadata import Supadata
from firecrawl import FirecrawlApp
from google import genai

router = APIRouter()

# Initialize clients
# Supadata doesn't seem to have a client class in the summary, it's a wrapper. 
# But let's assume we use the SDK functions or a client if available.
# Re-checking summary: "Supadata offers an official Python SDK... `supadata.youtube.transcript`"
# Actually, let's use the `supadata` package as intended.
# For Firecrawl: `app = FirecrawlApp(api_key=...)`

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY")
SUPADATA_API_KEY = os.environ.get("SUPADATA_API_KEY")

# In-memory job store for simplicity (Production: Use Redis/DB)
# We will write results to Supabase `jobs` table, but keep simple state here if needed? 
# Better to use Supabase as the source of truth for jobs to be "Production Ready".

async def process_ingestion(job_id: UUID, url: str):
    supabase = get_supabase_client()
    gemini = get_gemini_client()
    
    try:
        # Update job to creating/processing
        supabase.table("jobs").update({"status": "PROCESSING"}).eq("id", str(job_id)).execute()

        content = ""
        source_type = "web"

        # 1. Detect Source and Fetch Content
        if "youtube.com" in url or "youtu.be" in url:
            source_type = "youtube"
            # Supadata integration
            try:
                # Using Supadata to get transcript
                # Note: The exact syntax depends on the library version. 
                # Based on common patterns and docs:
                from supadata import Supadata
                client = Supadata(api_key=SUPADATA_API_KEY)
                
                print(f"Fetching metadata for: {url}")
                title = ""
                description = ""
                try:
                    metadata = client.metadata(url)
                    title = metadata.title
                    description = metadata.description
                    print(f"Metadata retrieved: Title='{title}'")
                except Exception as meta_e:
                    print(f"Metadata fetch failed (non-fatal): {meta_e}")
                    # Proceed without metadata

                print(f"Fetching transcript for: {url}")
                transcript_data = client.transcript(url, text=True)
                
                transcript_text = ""
                # Supadata v2 returns a Transcript object (sync) or BatchJob (async)
                if hasattr(transcript_data, 'content'):
                     transcript_text = transcript_data.content
                elif hasattr(transcript_data, 'job_id'):
                     print(f"Supadata job started: {transcript_data.job_id}")
                     # Poll for results (up to 60s)
                     import time
                     for _ in range(60):
                         time.sleep(1)
                         batch_res = client.youtube.batch.get_batch_results(transcript_data.job_id)
                         if batch_res.status == 'completed':
                             if batch_res.results and batch_res.results[0].transcript:
                                 transcript_text = batch_res.results[0].transcript.content
                                 break
                             else:
                                 raise ValueError("Job completed but no transcript found.")
                         elif batch_res.status == 'failed':
                             raise ValueError(f"Supadata job failed: {batch_res}")
                     else:
                         raise TimeoutError("Supadata processing timed out.")
                else:
                     raise ValueError("Failed to retrieve transcript immediately.")
                
                print(f"Transcript retrieved ({len(transcript_text or '')} chars)")
                
                # Combine Metadata and Transcript
                content = f"Title: {title}\nDescription: {description}\nTranscript: {transcript_text}"

            except Exception as e:
                # Fallback or error
                print(f"Supadata error: {e}")
                # Fallback to just basic info if possible or fail
                raise e
        else:
            # Firecrawl for Web
            app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
            scrape_result = app.scrape(url, formats=['markdown'])
            content = scrape_result.markdown or ''

        if not content:
            raise ValueError("No content extracted from source.")

        # 2. Gemini Extraction
        prompt = f"""
        Analyze the following content and extract ALL distinct recipes found. 
        If it is a listicle, extract each recipe separately.
        If the content is not a recipe, set `is_valid_content` to False.
        
        Content:
        {content}
        """
        
        # Generative Model Call
        response = gemini.models.generate_content(
            model='gemini-3-flash-preview', 
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': ExtractionResult
            }
        )
        
        extraction: ExtractionResult = response.parsed

        if not extraction.is_valid_content:
            supabase.table("jobs").update({
                "status": "FAILED", 
                "error_message": extraction.rejection_reason or "Invalid content"
            }).eq("id", str(job_id)).execute()
            return

        # 3. Save to Supabase
        recipe_ids = []
        for recipe in extraction.recipes:
            # Insert logic
            data = {
                "source_url": url,
                "title": recipe.title,
                "description": recipe.description,
                "ingredients": [i.model_dump() for i in recipe.ingredients],
                "steps": [s.model_dump() for s in recipe.steps],
                "servings": recipe.servings,
                "prep_time_minutes": recipe.prep_time_minutes,
                "cook_time_minutes": recipe.cook_time_minutes,
                "user_id": None # Link to user if auth is passed later
            }
            res = supabase.table("recipes").insert(data).execute()
            if res.data:
                recipe_ids.append(res.data[0]['id'])

        # 4. Complete Job
        supabase.table("jobs").update({
            "status": "COMPLETED",
            "result_recipe_ids": recipe_ids
        }).eq("id", str(job_id)).execute()

    except Exception as e:
        supabase.table("jobs").update({
            "status": "FAILED",
            "error_message": str(e)
        }).eq("id", str(job_id)).execute()


@router.post("/extract", response_model=JobStatus)
async def start_extraction(url: HttpUrl, background_tasks: BackgroundTasks):
    job_id = uuid4()
    supabase = get_supabase_client()
    
    # Create Job
    job_data = {
        "id": str(job_id),
        "status": "PENDING",
        "result_recipe_ids": []
    }
    supabase.table("jobs").insert(job_data).execute()

    # Start Background Task
    background_tasks.add_task(process_ingestion, job_id, str(url))

    return JobStatus(id=job_id, status="PENDING")

@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: UUID):
    supabase = get_supabase_client()
    res = supabase.table("jobs").select("*").eq("id", str(job_id)).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = res.data[0]
    return JobStatus(**job)
