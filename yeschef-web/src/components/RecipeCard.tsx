import { Clock, Users, ArrowRight, Pause } from "lucide-react";
import { useState, useEffect } from "react";
import type { Recipe } from "../store/recipeStore";

interface SavedSession {
  recipeId: string;
  currentStep: number;
  elapsedSeconds: number;
  pausedAt: number;
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const [pausedStep, setPausedStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("yeschef-session-" + recipe.id);
      if (!raw) return;
      const s: SavedSession = JSON.parse(raw);
      // Check 4-hour expiry
      if (Date.now() - s.pausedAt > 4 * 60 * 60 * 1000) {
        localStorage.removeItem("yeschef-session-" + recipe.id);
        return;
      }
      setPausedStep(s.currentStep + 1); // Display as 1-indexed
    } catch {
      // ignore
    }
  }, [recipe.id]);

  // Generate a warm gradient as placeholder when no thumbnail
  const gradients = [
    "linear-gradient(135deg, #E8940A 0%, #C75B39 100%)",
    "linear-gradient(135deg, #C75B39 0%, #6B7F4E 100%)",
    "linear-gradient(135deg, #6B7F4E 0%, #E8940A 100%)",
    "linear-gradient(135deg, #E07A5F 0%, #FDB94D 100%)",
    "linear-gradient(135deg, #8FA76A 0%, #E8940A 100%)",
  ];
  const gradientIndex =
    recipe.title.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    gradients.length;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "all 0.3s var(--ease-out)",
        border: "1px solid rgba(245,237,227,0.8)",
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia("(hover: hover)").matches) {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow =
            "var(--shadow-lg), 0 0 0 1px rgba(232,148,10,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      {/* Thumbnail / Gradient */}
      <div
        style={{
          height: "clamp(140px, 25vw, 180px)",
          background: recipe.thumbnail_url
            ? `url(${recipe.thumbnail_url}) center/cover`
            : gradients[gradientIndex],
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!recipe.thumbnail_url && (
          <img
            src="/logo.png"
            alt="YesChef Logo"
            style={{
              height: 48,
              opacity: 0.25,
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)' // Make it white-ish to match previous icon feel
            }}
          />
        )}

        {/* Platform badge */}
        {recipe.source_platform && recipe.source_platform !== "web" && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {recipe.source_platform}
          </span>
        )}

        {/* Difficulty badge */}
        {recipe.difficulty && (
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color:
                recipe.difficulty === "easy"
                  ? "var(--olive)"
                  : recipe.difficulty === "hard"
                    ? "var(--terracotta)"
                    : "var(--saffron)",
            }}
          >
            {recipe.difficulty}
          </span>
        )}

        {/* Paused session badge */}
        {pausedStep !== null && (
          <span
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(232,148,10,0.9)",
              backdropFilter: "blur(8px)",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              color: "#fff",
              letterSpacing: "0.03em",
            }}
          >
            <Pause size={10} />
            Step {pausedStep}/{recipe.steps.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "var(--space-lg)" }}>
        {/* Cuisine tag */}
        {recipe.cuisine && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--saffron)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
              display: "block",
            }}
          >
            {recipe.cuisine}
          </span>
        )}

        <h3
          style={{
            marginBottom: "var(--space-sm)",
            fontSize: "1.15rem",
            lineHeight: 1.3,
          }}
        >
          {recipe.title}
        </h3>

        {recipe.description && (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--warm-gray)",
              lineHeight: 1.5,
              marginBottom: "var(--space-md)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {recipe.description}
          </p>
        )}

        {/* Meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "var(--space-md)",
            borderTop: "1px solid var(--cream-dark)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-md)",
              fontSize: "0.8rem",
              color: "var(--warm-gray)",
            }}
          >
            {recipe.total_time && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Clock size={13} /> {recipe.total_time}
              </span>
            )}
            {recipe.servings && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Users size={13} /> {recipe.servings}
              </span>
            )}
          </div>

          <ArrowRight size={16} color="var(--saffron)" />
        </div>
      </div>
    </div>
  );
}
