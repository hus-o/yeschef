from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


# ── Extraction Models (used by Gemini structured output) ──

class Ingredient(BaseModel):
    item: str = Field(..., description="The name of the ingredient")
    quantity: str = Field("", description="A precise numeric quantity (e.g., '1', '1/2', '100', '250'). Never vague words like 'some' or 'several'.")
    unit: str = Field("", description="Measurement unit. Convert cups to ml (1 cup=240ml, 1/2 cup=120ml). Never abbreviate: write 'tablespoon' not 'tbsp', 'teaspoon' not 'tsp'.")
    notes: Optional[str] = Field(None, description="Preparation notes only (e.g., 'finely diced', 'room temperature', 'freshly grated'). Never repeat the item name.")

class Step(BaseModel):
    step_number: int = Field(..., description="Step number starting from 1")
    instruction: str = Field(..., description="Clear, self-contained instruction a beginner can follow without watching the original video.")
    duration_minutes: Optional[int] = Field(None, description="Estimated time in minutes. Be realistic for a home cook, not a professional.")
    tip: Optional[str] = Field(None, description="Professional cooking advice for this step. MUST be self-contained — never reference techniques, tricks, or methods not fully explained in this step's instruction field. The user has NOT seen the source video.")

class RecipeData(BaseModel):
    title: str = Field(..., description="The title of the recipe")
    description: str = Field("", description="A short description of the recipe")
    ingredients: List[Ingredient] = Field(default_factory=list, description="List of ingredients")
    steps: List[Step] = Field(default_factory=list, description="List of cooking steps")
    servings: str = Field("", description="Number of servings (e.g., '4', '2-3')")
    prep_time: str = Field("", description="Preparation time (e.g., '15 min', '1 hour')")
    cook_time: str = Field("", description="Cooking time (e.g., '30 min', '2 hours')")
    total_time: str = Field("", description="Total time (e.g., '45 min', '3 hours')")
    difficulty: str = Field("medium", description="Difficulty level: 'easy', 'medium', or 'hard'")
    cuisine: str = Field("", description="Cuisine type (e.g., 'Italian', 'Mexican', 'Japanese')")
    tags: List[str] = Field(default_factory=list, description="Tags (e.g., ['vegetarian', 'quick', 'dessert'])")
    confidence: float = Field(0.8, description="Extraction confidence 0.0-1.0")

class ExtractionResult(BaseModel):
    is_valid_content: bool = Field(..., description="True if content contains at least one recipe. False otherwise.")
    recipes: List[RecipeData] = Field(default_factory=list, description="List of extracted recipes.")
    rejection_reason: Optional[str] = Field(None, description="Reason if no recipes were found.")


# ── API Request / Response Models ──

class ExtractRequest(BaseModel):
    url: str = Field(..., description="URL to extract recipe(s) from")

class JobStatus(BaseModel):
    id: UUID
    source_url: Optional[str] = None
    status: str
    recipe_ids: Optional[List[str]] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None

class RecipeResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    source_url: Optional[str] = None
    source_platform: Optional[str] = None
    thumbnail_url: Optional[str] = None
    servings: Optional[str] = None
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    total_time: Optional[str] = None
    difficulty: Optional[str] = None
    cuisine: Optional[str] = None
    ingredients: List[dict] = []
    steps: List[dict] = []
    tags: Optional[List[str]] = None
    confidence: Optional[float] = None
    created_at: Optional[datetime] = None

class RecipeListResponse(BaseModel):
    recipes: List[RecipeResponse]
    total: int


# ── LiveKit Models ──

class LiveTokenRequest(BaseModel):
    recipe_id: str
    user_id: str = "demo-user"
    user_name: str = "Chef"
    resume_from_step: Optional[int] = None  # step number to resume from (1-indexed)

class LiveTokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str


# ── Cook Session Models ──

class SessionSummaryRequest(BaseModel):
    session_id: str

class SessionSummaryResponse(BaseModel):
    session_id: str
    summary: str
    duration_seconds: Optional[int] = None
    steps_completed: Optional[int] = None
    total_steps: Optional[int] = None
