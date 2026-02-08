import { create } from "zustand";

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  checked: boolean;
}

export interface Step {
  number: number;
  instruction: string;
  duration?: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  source_url: string;
  source_platform: string;
  thumbnail_url: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  cuisine: string;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  confidence: number;
}

export interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  recipe_ids?: string[];
}

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  currentJob: Job | null;
  isExtracting: boolean;
  error: string | null;

  setRecipes: (recipes: Recipe[]) => void;
  addRecipe: (recipe: Recipe) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  setCurrentJob: (job: Job | null) => void;
  setIsExtracting: (val: boolean) => void;
  setError: (error: string | null) => void;
  toggleIngredient: (recipeId: string, ingredientIndex: number) => void;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  currentRecipe: null,
  currentJob: null,
  isExtracting: false,
  error: null,

  setRecipes: (recipes) => set({ recipes }),
  addRecipe: (recipe) =>
    set((state) => ({ recipes: [recipe, ...state.recipes] })),
  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe }),
  setCurrentJob: (job) => set({ currentJob: job }),
  setIsExtracting: (val) => set({ isExtracting: val }),
  setError: (error) => set({ error }),
  toggleIngredient: (recipeId, ingredientIndex) =>
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === recipeId
          ? {
              ...r,
              ingredients: r.ingredients.map((ing, i) =>
                i === ingredientIndex ? { ...ing, checked: !ing.checked } : ing,
              ),
            }
          : r,
      ),
    })),
}));
