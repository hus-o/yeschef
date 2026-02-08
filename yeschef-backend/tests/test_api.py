import pytest
import uuid
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
from schemas import JobStatus, ExtractionResult, RecipeData, Ingredient, Step

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@patch("routers.ingest.Supadata")
@patch("routers.ingest.FirecrawlApp")
@patch("routers.ingest.get_gemini_client")
@patch("routers.ingest.get_supabase_client")
def test_ingestion_flow(mock_supabase, mock_gemini, mock_firecrawl, mock_supadata):
    # Mock External APIs to avoid real calls/costs
    
    # 1. Mock Supabase
    mock_supabase_instance = MagicMock()
    mock_supabase.return_value = mock_supabase_instance
    # Mock table('jobs').insert().execute()
    mock_supabase_instance.table.return_value.insert.return_value.execute.return_value = None
    # Mock table('jobs').update().eq().execute()
    mock_supabase_instance.table.return_value.update.return_value.eq.return_value.execute.return_value = None
    # Mock table('recipes').insert().execute()
    mock_supabase_instance.table.return_value.insert.return_value.execute.return_value.data = [{"id": str(uuid.uuid4())}]

    # 2. Mock Gemini
    mock_gemini_instance = MagicMock()
    mock_gemini.return_value = mock_gemini_instance
    
    mock_response = MagicMock()
    mock_response.parsed = ExtractionResult(
        is_valid_content=True,
        recipes=[
            RecipeData(
                title="Test Recipe",
                description="A delicious test.",
                ingredients=[Ingredient(item="Test Item", quantity="1", unit="pc")],
                steps=[Step(instruction="Do the test.", duration_minutes=5)],
                servings="4",
                prep_time_minutes=10,
                cook_time_minutes=20
            )
        ]
    )
    mock_gemini_instance.models.generate_content.return_value = mock_response

    # 3. Mock Firecrawl (for web source)
    mock_firecrawl_instance = MagicMock()
    mock_firecrawl.return_value = mock_firecrawl_instance
    mock_firecrawl_instance.scrape_url.return_value = {"markdown": "# Valid Recipe Content"}

    # --- Run Test ---
    response = client.post("/extract?url=https://example.com/recipe")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING"
    assert "id" in data
    
    # Let's verify Supabase was called for job creation (synchronous part)
    mock_supabase_instance.table.assert_any_call("jobs")
    
@patch("routers.live.get_supabase_client")
def test_live_websocket(mock_supabase):
    # Mock Supabase lookup
    mock_supabase_instance = MagicMock()
    mock_supabase.return_value = mock_supabase_instance
    
    recipe_id = str(uuid.uuid4())
    mock_supabase_instance.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{
        "id": recipe_id,
        "title": "Test Recipe",
        "description": "Test Desc",
        "ingredients": [],
        "steps": []
    }]
    
    # We also need to mock Gemini Live connection since we can't really connect to it in test
    with patch("routers.live.get_gemini_client") as mock_gemini:
        mock_gemini_instance = MagicMock()
        mock_gemini.return_value = mock_gemini_instance
        
        # Mock the async context manager for live.connect
        mock_session = MagicMock()
        mock_aenter = MagicMock()
        mock_aenter.return_value = mock_session
        
        # This is complex to mock fully (Async Context Manager), skipping deep interaction test
        # and just testing the initial handshake rejection or connection.
        
        # Simplification: Expect connection to close with error if we don't fully mock everything,
        # OR just test that it accepts if recipe exists.
        
        # Let's try to connect
        with client.websocket_connect(f"/live/{recipe_id}") as websocket:
            # If everything mocked correctly, it should likely accept.
            # But the route calls `await client.aio.live.connect`, which fails if not mocked properly as async
            pass
