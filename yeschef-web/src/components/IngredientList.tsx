import type { Ingredient } from "../store/recipeStore";

interface IngredientListProps {
  ingredients: Ingredient[];
  onToggle: (index: number) => void;
}

export default function IngredientList({
  ingredients,
  onToggle,
}: IngredientListProps) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {ingredients.map((ing, i) => (
        <li key={i} onClick={() => onToggle(i)} style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={ing.checked} readOnly />
          <span>
            {ing.amount} {ing.unit} {ing.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
