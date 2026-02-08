import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

def check_table(table_name):
    print(f"Checking table '{table_name}'...")
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=1"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print(f"✅ Table '{table_name}' exists.")
            return True
        elif response.status_code == 404:
             # PostgREST returns 404 if table doesn't exist AND 404 if row not found? 
             # No, 404 on the endpoint usually means resource (table) not found in schema.
             # Empty result set is 200 []
             print(f"❌ Table '{table_name}' NOT found (404).")
             return False
        else:
             print(f"❌ Unexpected status for '{table_name}': {response.status_code} - {response.text}")
             return False
    except Exception as e:
        print(f"❌ Error checking '{table_name}': {e}")
        return False

if __name__ == "__main__":
    if not SUPABASE_URL:
        print("❌ SUPABASE_URL not set.")
        exit(1)
    
    recipes_ok = check_table("recipes")
    jobs_ok = check_table("jobs")
    
    if recipes_ok and jobs_ok:
        print("\n✅ All tables appear to be set up.")
    else:
        print("\n⚠️ Database tables missing. Please run schema.sql.")
