import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChefHat,
  ArrowLeft,
  Clock,
  Users,
  Flame,
  PlayCircle,
  ChevronRight,
  ExternalLink,
  Tag,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";
import {
  useRecipeStore,
  type Recipe as RecipeType,
} from "../store/recipeStore";
import IngredientList from "../components/IngredientList";
import StepCard from "../components/StepCard";

export default function Recipe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipes, setCurrentRecipe, toggleIngredient } = useRecipeStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeType | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadRecipe = async () => {
      // Check store first
      const stored = recipes.find((r) => r.id === id);
      if (stored) {
        setRecipe(stored);
        setCurrentRecipe(stored);
        setLoading(false);
        return;
      }

      // Fetch from API
      try {
        const data = await api.getRecipe(id);
        const mapped = mapApiRecipe(data);
        setRecipe(mapped);
        setCurrentRecipe(mapped);
      } catch {
        setError("Recipe not found");
      } finally {
        setLoading(false);
      }
    };

    loadRecipe();
  }, [id, recipes, setCurrentRecipe]);

  // Keep local recipe in sync with store (for toggleIngredient)
  useEffect(() => {
    if (id) {
      const stored = recipes.find((r) => r.id === id);
      if (stored) setRecipe(stored);
    }
  }, [recipes, id]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <Loader2
          size={32}
          color="var(--saffron)"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <p style={{ color: "var(--warm-gray)" }}>Loading recipe…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--page-padding)",
        }}
      >
        <p style={{ color: "var(--danger)", fontSize: "1.1rem" }}>
          {error || "Recipe not found"}
        </p>
        <Link to="/" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>
    );
  }

  const difficultyClass =
    recipe.difficulty === "easy"
      ? "badge-easy"
      : recipe.difficulty === "hard"
        ? "badge-hard"
        : "badge-medium";

  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* ── Top Bar ── */}
      <header
        style={{
          padding: "var(--space-md) var(--page-padding)",
          paddingTop: "calc(var(--space-md) + var(--safe-top))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "var(--max-width)",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/")}
          style={{ gap: 6 }}
        >
          <ArrowLeft size={18} /> Home
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <ChefHat size={22} color="var(--saffron)" />
          <span
            style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
          >
            YesChef
          </span>
        </div>
      </header>

      <main
        className="container animate-in"
        style={{
          paddingTop: "var(--space-md)",
          paddingBottom: "var(--space-2xl)",
        }}
      >
        {/* ── Hero Area ── */}
        <div
          style={{
            background: "var(--white)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
            marginBottom: "var(--space-xl)",
          }}
        >
          {/* Thumbnail or colored header */}
          <div
            style={{
              height: recipe.thumbnail_url
                ? "clamp(180px, 35vw, 280px)"
                : "clamp(100px, 20vw, 160px)",
              background: recipe.thumbnail_url
                ? `url(${recipe.thumbnail_url}) center/cover`
                : "linear-gradient(135deg, var(--saffron) 0%, var(--terracotta) 100%)",
              display: "flex",
              alignItems: "flex-end",
              padding: "var(--space-lg)",
              position: "relative",
            }}
          >
            {!recipe.thumbnail_url && (
              <ChefHat
                size={48}
                color="rgba(255,255,255,0.2)"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                }}
              />
            )}
          </div>

          <div style={{ padding: "var(--space-lg)" }}>
            {/* Badges */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-sm)",
                marginBottom: "var(--space-md)",
              }}
            >
              {recipe.difficulty && (
                <span className={`badge ${difficultyClass}`}>
                  {recipe.difficulty}
                </span>
              )}
              {recipe.cuisine && (
                <span className="badge badge-platform">{recipe.cuisine}</span>
              )}
              {recipe.source_platform && recipe.source_platform !== "web" && (
                <span className="badge badge-platform">
                  {recipe.source_platform}
                </span>
              )}
            </div>

            <h1
              style={{
                marginBottom: "var(--space-sm)",
                fontSize: "clamp(1.35rem, 4vw, 2.5rem)",
              }}
            >
              {recipe.title}
            </h1>

            {recipe.description && (
              <p
                style={{
                  fontSize: "clamp(0.9rem, 2.5vw, 1.05rem)",
                  color: "var(--charcoal-mid)",
                  marginBottom: "var(--space-lg)",
                  maxWidth: 640,
                  lineHeight: 1.7,
                }}
              >
                {recipe.description}
              </p>
            )}

            {/* Meta row */}
            <div
              className="meta-row"
              style={{
                paddingTop: "var(--space-md)",
                borderTop: "1px solid var(--cream-dark)",
              }}
            >
              {recipe.total_time && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--charcoal-mid)",
                    fontSize: "0.88rem",
                  }}
                >
                  <Clock size={16} color="var(--saffron)" />
                  {recipe.total_time}
                </div>
              )}
              {recipe.servings && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--charcoal-mid)",
                    fontSize: "0.88rem",
                  }}
                >
                  <Users size={16} color="var(--saffron)" />
                  {recipe.servings} servings
                </div>
              )}
              {recipe.prep_time && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--charcoal-mid)",
                    fontSize: "0.88rem",
                  }}
                >
                  <Flame size={14} color="var(--terracotta-light)" />
                  Prep: {recipe.prep_time}
                </div>
              )}
              {recipe.cook_time && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--charcoal-mid)",
                    fontSize: "0.88rem",
                  }}
                >
                  <Flame size={14} color="var(--terracotta)" />
                  Cook: {recipe.cook_time}
                </div>
              )}
            </div>

            {/* Source link */}
            {recipe.source_url &&
              !recipe.source_url.startsWith("https://example.com") && (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: "var(--space-md)",
                    fontSize: "0.85rem",
                    color: "var(--warm-gray)",
                  }}
                >
                  <ExternalLink size={13} /> View original source
                </a>
              )}
          </div>
        </div>

        {/* ── Two-Column → Single-Column Layout (CSS class) ── */}
        <div className="recipe-layout">
          {/* Ingredients */}
          <div>
            <div
              style={{
                background: "var(--white)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-lg)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h3 style={{ marginBottom: "var(--space-lg)" }}>
                Ingredients
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "var(--font-body)",
                    color: "var(--warm-gray)",
                    fontWeight: 400,
                    marginLeft: 8,
                  }}
                >
                  ({recipe.ingredients.length})
                </span>
              </h3>
              <IngredientList
                ingredients={recipe.ingredients}
                onToggle={(i) => toggleIngredient(recipe.id, i)}
              />
            </div>
          </div>

          {/* Ready to Cook CTA (between ingredients & steps) */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(232,148,10,0.08), rgba(199,91,57,0.05))",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-lg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-md)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 style={{ marginBottom: 4, fontSize: "1.05rem" }}>
                  Ready to cook?
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--warm-gray)",
                    margin: 0,
                  }}
                >
                  YesChef will guide you step-by-step with AI voice assistance.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/cook/${recipe.id}`)}
                style={{ gap: 8, whiteSpace: "nowrap" }}
              >
                <PlayCircle size={18} />
                Start Cooking
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Steps */}
          <div>
            <h3 style={{ marginBottom: "var(--space-lg)" }}>Instructions</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
              }}
            >
              {recipe.steps.map((step, idx) => (
                <div
                  key={step.number || idx}
                  className="animate-in"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <StepCard step={step} isActive={false} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tags ── */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div
            style={{
              marginTop: "var(--space-xl)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
            }}
          >
            <Tag size={14} color="var(--warm-gray-lt)" />
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="badge badge-platform"
                style={{ textTransform: "none", fontWeight: 500 }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Start Cooking CTA ── */}
        <div style={{ marginTop: "var(--space-2xl)", textAlign: "center" }}>
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(232,148,10,0.06), rgba(199,91,57,0.04))",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl) var(--space-lg)",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <h3 style={{ marginBottom: "var(--space-sm)" }}>Ready to cook?</h3>
            <p
              style={{
                fontSize: "0.92rem",
                color: "var(--warm-gray)",
                marginBottom: "var(--space-lg)",
              }}
            >
              YesChef will guide you through every step with AI voice
              assistance. Just say "next" when you're ready to move on.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate(`/cook/${recipe.id}`)}
              style={{
                fontSize: "1.05rem",
                padding: "1rem 2rem",
                gap: 10,
                width: "100%",
                maxWidth: 320,
              }}
            >
              <PlayCircle size={22} />
              Start Cooking
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helper to map API response to store Recipe type ──
function mapApiRecipe(r: Record<string, unknown>): RecipeType {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) || "",
    source_url: (r.source_url as string) || "",
    source_platform: (r.source_platform as string) || "web",
    thumbnail_url: (r.thumbnail_url as string) || "",
    servings: (r.servings as string) || "",
    prep_time: (r.prep_time as string) || "",
    cook_time: (r.cook_time as string) || "",
    total_time: (r.total_time as string) || "",
    difficulty: (r.difficulty as string) || "medium",
    cuisine: (r.cuisine as string) || "",
    ingredients: ((r.ingredients as Array<Record<string, string>>) || []).map(
      (i) => ({
        name: i.item || i.name || "",
        amount: i.quantity || i.amount || "",
        unit: i.unit || "",
        checked: false,
      }),
    ),
    steps: ((r.steps as Array<Record<string, unknown>>) || []).map((s) => ({
      number: (s.step_number as number) || (s.number as number) || 0,
      instruction: (s.instruction as string) || "",
      duration: s.duration_minutes
        ? `${s.duration_minutes} min`
        : (s.duration as string) || undefined,
      tip: (s.tip as string) || undefined,
    })),
    tags: (r.tags as string[]) || [],
    confidence: (r.confidence as number) || 0.8,
  };
}
