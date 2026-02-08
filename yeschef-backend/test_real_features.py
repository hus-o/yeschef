import asyncio
import websockets
import requests
import json
import os
import uuid
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use service role if available, else anon key might fail RLS if not set up

# Fallback to anon key if service role not found
if not SUPABASE_KEY:
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

async def test_live_mode(recipe_id):
    print(f"\n--- Testing Live Mode (WebSocket) for Recipe ID: {recipe_id} ---")
    uri = f"{WS_URL}/live/{recipe_id}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected.")
            
            # Send a test message
            msg = {"text": "Hello! What are we cooking?"}
            await websocket.send(json.dumps(msg))
            print(f"SENT: {msg}")
            
            # Wait for response (timeout 10s)
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                print(f"RECEIVED: {response}")
                print("✅ Live Mode verification Passed (Response received).")
            except asyncio.TimeoutError:
                print("❌ Live Mode verification Failed (Timeout waiting for response).")
                
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")

def seed_test_recipe():
    print("\n--- Seeding Test Recipe ---")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing Supabase credentials in .env, cannot seed recipe.")
        return None

    # Insert a dummy recipe directly into Supabase for testing
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    dummy_id = str(uuid.uuid4())
    data = {
        "id": dummy_id,
        "title": "Test Recipe for Live Mode",
        "description": "A simple test recipe.",
        "ingredients": [{"item": "Water", "quantity": "1", "unit": "cup"}],
        "steps": [{"instruction": "Boil water.", "duration_minutes": 5}],
        "servings": "1",
        "prep_time_minutes": 1,
        "cook_time_minutes": 5
    }
    
    response = requests.post(f"{SUPABASE_URL}/rest/v1/recipes", headers=headers, json=data)
    
    if response.status_code in [200, 201]:
        print(f"✅ Created test recipe with ID: {dummy_id}")
        return dummy_id
    else:
        print(f"❌ Failed to seed recipe: {response.status_code} - {response.text}")
        return None

def test_extraction():
    print("\n--- Testing Extraction Endpoint ---")
    url = "https://www.youtube.com/shorts/uWoB0_3wSrY" # Use a generic URL just to trigger the pipeline (Firecrawl might fail or extract garbage, but pipeline runs)
    
    try:
        res = requests.post(f"{BASE_URL}/extract", params={"url": url})
        if res.status_code == 200:
            print(f"✅ Extraction request received status 200.")
            job_data = res.json()
            print(f"Response: {job_data}")
            
            job_id = job_data.get("id")
            if job_id:
                print(f"Job ID: {job_id}. Checking status in 5 seconds...")
                time.sleep(5)
                res_status = requests.get(f"{BASE_URL}/jobs/{job_id}")
                print(f"Job Status: {res_status.json()}")
        else:
            print(f"❌ Extraction request failed: {res.status_code} - {res.text}")
            
    except Exception as e:
        print(f"❌ Request Error: {e}")

if __name__ == "__main__":
    print(f"Checking server at {BASE_URL}...")
    try:
        if requests.get(f"{BASE_URL}/health").status_code == 200:
            print("✅ Server is UP.")
        else:
            print("❌ Server is NOT responding correctly to /health.")
            exit(1)
            
        test_extraction()
        
        recipe_id = seed_test_recipe()
        if recipe_id:
            asyncio.run(test_live_mode(recipe_id))
        else:
            print("Skipping Live Mode test due to seeding failure.")
            
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        print("Is the server running? (Use: ./venv/bin/uvicorn main:app --port 8000)")
