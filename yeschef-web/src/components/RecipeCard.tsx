import type { Recipe } from "../store/recipeStore";

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      <h3>{recipe.title}</h3>
      <p>{recipe.description}</p>
    </div>
  );
}
