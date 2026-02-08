from pydantic import BaseModel, Field
from typing import List, Optional, Any
from uuid import UUID

class Ingredient(BaseModel):
    item: str = Field(..., description="The name of the ingredient")
    quantity: str = Field(..., description="The quantity of the ingredient (e.g., '1', '1/2', '100')")
    unit: str = Field(..., description="The unit of the ingredient (e.g., 'cup', 'g', 'ml', 'tablespoon')")

class Step(BaseModel):
    instruction: str = Field(..., description="The step-by-step instruction")
    duration_minutes: Optional[int] = Field(None, description="Estimated time for this step in minutes")

class RecipeData(BaseModel):
    title: str = Field(..., description="The title of the recipe")
    description: str = Field(..., description="A short description of the recipe")
    ingredients: List[Ingredient] = Field(default_factory=list, description="List of ingredients")
    steps: List[Step] = Field(default_factory=list, description="List of cooking steps")
    servings: str = Field(..., description="Number of servings (e.g., '4', '2-3')")
    prep_time_minutes: int = Field(..., description="Preparation time in minutes")
    cook_time_minutes: int = Field(..., description="Cooking time in minutes")

class ExtractionResult(BaseModel):
    is_valid_content: bool = Field(..., description="True if content contains at least one recipe. False otherwise.")
    recipes: List[RecipeData] = Field(default_factory=list, description="List of extracted recipes.")
    rejection_reason: Optional[str] = Field(None, description="Reason if no recipes were found.")

class JobStatus(BaseModel):
    id: UUID
    status: str
    result_recipe_ids: Optional[List[UUID]] = None
    error_message: Optional[str] = None
