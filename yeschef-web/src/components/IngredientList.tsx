import { Check } from "lucide-react";
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
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {ingredients.map((ing, i) => {
        const hasAmount = ing.amount || ing.unit;

        return (
          <li
            key={i}
            onClick={() => onToggle(i)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-md)",
              padding: "var(--space-md) 0",
              minHeight: 48,
              cursor: "pointer",
              borderBottom:
                i < ingredients.length - 1
                  ? "1px solid var(--cream-dark)"
                  : "none",
              transition: "opacity 0.2s ease",
              opacity: ing.checked ? 0.45 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Checkbox */}
            <div
              style={{
                width: 24,
                height: 24,
                minWidth: 24,
                borderRadius: 6,
                border: ing.checked
                  ? "2px solid var(--olive)"
                  : "2px solid var(--warm-gray-lt)",
                background: ing.checked ? "var(--olive)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s var(--ease-spring)",
                marginTop: 2,
              }}
            >
              {ing.checked && (
                <Check size={13} color="var(--white)" strokeWidth={3} />
              )}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: "0.92rem",
                  fontWeight: 500,
                  color: "var(--charcoal)",
                  textDecoration: ing.checked ? "line-through" : "none",
                }}
              >
                {ing.name}
              </span>

              {hasAmount && (
                <span
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: "var(--warm-gray)",
                    fontWeight: 400,
                    marginTop: 1,
                  }}
                >
                  {ing.amount}
                  {ing.unit ? ` ${ing.unit}` : ""}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
