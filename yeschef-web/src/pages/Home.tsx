import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChefHat,
  Link as LinkIcon,
  ArrowRight,
  Loader2,
  Sparkles,
  Youtube,
  Instagram,
  Globe,
  AlertCircle,
  Mic,
} from "lucide-react";
import { api } from "../services/api";
import { useRecipeStore, type Recipe } from "../store/recipeStore";
import RecipeCard from "../components/RecipeCard";

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [demoRecipes, setDemoRecipes] = useState<Recipe[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recipes, addRecipe } = useRecipeStore();

  // Load demo recipes on mount
  useEffect(() => {
    const loadDemos = async () => {
      try {
        const data = await api.getDemoRecipes();
        const list = Array.isArray(data) ? data : data.recipes || [];
        setDemoRecipes(
          list.map((r: Record<string, unknown>) => ({
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
            ingredients: (
              (r.ingredients as Array<Record<string, string>>) || []
            ).map((i) => ({
              name: i.item || i.name || "",
              amount: i.quantity || i.amount || "",
              unit: i.unit || "",
              checked: false,
            })),
            steps: ((r.steps as Array<Record<string, unknown>>) || []).map(
              (s) => ({
                number: (s.step_number as number) || (s.number as number) || 0,
                instruction: (s.instruction as string) || "",
                duration: s.duration_minutes
                  ? `${s.duration_minutes} min`
                  : (s.duration as string) || undefined,
                tip: (s.tip as string) || undefined,
              }),
            ),
            tags: (r.tags as string[]) || [],
            confidence: (r.confidence as number) || 0.8,
          })),
        );
      } catch {
        console.warn("Could not load demo recipes");
      } finally {
        setLoadingDemos(false);
      }
    };
    loadDemos();
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      setExtractionStatus("Extracting recipe…");
      let polls = 0;
      const maxPolls = 60;

      pollRef.current = setInterval(async () => {
        polls++;
        if (polls > maxPolls) {
          if (pollRef.current) clearInterval(pollRef.current);
          setExtracting(false);
          setError("Extraction timed out. Please try again.");
          return;
        }

        try {
          const job = await api.getJob(jobId);

          if (polls < 5) setExtractionStatus("Reading content…");
          else if (polls < 15)
            setExtractionStatus("AI is analyzing the recipe…");
          else if (polls < 30) setExtractionStatus("Almost done…");

          if (job.status === "completed" && job.recipe_ids?.length) {
            if (pollRef.current) clearInterval(pollRef.current);
            setExtracting(false);
            setExtractionStatus("");

            const recipeId = job.recipe_ids[0];
            try {
              const recipe = await api.getRecipe(recipeId);
              const mapped: Recipe = {
                id: recipe.id,
                title: recipe.title,
                description: recipe.description || "",
                source_url: recipe.source_url || "",
                source_platform: recipe.source_platform || "web",
                thumbnail_url: recipe.thumbnail_url || "",
                servings: recipe.servings || "",
                prep_time: recipe.prep_time || "",
                cook_time: recipe.cook_time || "",
                total_time: recipe.total_time || "",
                difficulty: recipe.difficulty || "medium",
                cuisine: recipe.cuisine || "",
                ingredients: (recipe.ingredients || []).map(
                  (i: Record<string, string>) => ({
                    name: i.item || i.name || "",
                    amount: i.quantity || i.amount || "",
                    unit: i.unit || "",
                    checked: false,
                  }),
                ),
                steps: (recipe.steps || []).map(
                  (s: Record<string, unknown>) => ({
                    number:
                      (s.step_number as number) || (s.number as number) || 0,
                    instruction: (s.instruction as string) || "",
                    duration: s.duration_minutes
                      ? `${s.duration_minutes} min`
                      : (s.duration as string) || undefined,
                    tip: (s.tip as string) || undefined,
                  }),
                ),
                tags: recipe.tags || [],
                confidence: recipe.confidence || 0.8,
              };
              addRecipe(mapped);
              navigate(`/recipe/${recipeId}`);
            } catch {
              navigate(`/recipe/${recipeId}`);
            }
          } else if (job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setExtracting(false);
            setError(job.error || "Extraction failed. Please try another URL.");
          }
        } catch {
          // Network blip, keep polling
        }
      }, 2000);
    },
    [addRecipe, navigate],
  );

  const handleExtract = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setError(null);
    setExtracting(true);
    setExtractionStatus("Sending to YesChef…");

    try {
      const data = await api.extractRecipe(trimmed);
      pollJob(data.job_id || data.id);
    } catch (err) {
      setExtracting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start extraction. Is the backend running?",
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !extracting) handleExtract();
  };

  const allRecipes = [
    ...recipes,
    ...demoRecipes.filter((d) => !recipes.some((r) => r.id === d.id)),
  ];

  return (
    <div
      style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}
    >
      {/* ── Header ── */}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <ChefHat size={26} color="var(--saffron)" strokeWidth={2.2} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.35rem",
              color: "var(--charcoal)",
            }}
          >
            YesChef
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          <Mic size={14} color="var(--warm-gray)" />
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--warm-gray)",
              fontWeight: 500,
            }}
          >
            Powered by Gemini
          </span>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section
        style={{
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-2xl) var(--page-padding) var(--space-xl)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative background circles */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: 250,
            height: 250,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,148,10,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="animate-in"
          style={{
            maxWidth: 680,
            position: "relative",
            zIndex: 1,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(232,148,10,0.08)",
              padding: "6px 14px",
              borderRadius: "var(--radius-full)",
              marginBottom: "var(--space-md)",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--saffron)",
            }}
          >
            <Sparkles size={13} />
            AI-Powered Cooking Assistant
          </div>

          <h1 style={{ marginBottom: "var(--space-sm)" }}>
            Paste a recipe.
            <br />
            <span style={{ color: "var(--saffron)" }}>
              Cook with confidence.
            </span>
          </h1>

          <p
            style={{
              fontSize: "clamp(0.88rem, 2.5vw, 1.1rem)",
              color: "var(--warm-gray)",
              maxWidth: 520,
              margin: "0 auto var(--space-xl)",
              lineHeight: 1.7,
            }}
          >
            Drop any recipe link from YouTube, TikTok, Instagram, or the web.
            YesChef extracts it and guides you through cooking — step by step,
            with voice.
          </p>

          {/* ── URL Input (stacked on mobile via CSS class) ── */}
          <div className="url-input-row">
            <div style={{ position: "relative", flex: 1 }}>
              <LinkIcon
                size={18}
                color="var(--warm-gray-lt)"
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={extracting}
                style={{
                  paddingLeft: 44,
                  paddingRight: 16,
                  height: 52,
                  fontSize: "16px",
                  borderRadius: "var(--radius-xl)",
                  opacity: extracting ? 0.6 : 1,
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={extracting || !url.trim()}
              style={{
                borderRadius: "var(--radius-xl)",
                padding: "0 1.5rem",
                height: 52,
                whiteSpace: "nowrap",
                opacity: extracting || !url.trim() ? 0.6 : 1,
              }}
            >
              {extracting ? (
                <Loader2
                  size={18}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <>
                  Extract Recipe
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Extraction status */}
          {extracting && (
            <div
              style={{
                marginTop: "var(--space-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "var(--saffron)",
                fontSize: "0.88rem",
                fontWeight: 500,
                animation: "fadeIn 0.3s ease both",
              }}
            >
              <Loader2
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
              {extractionStatus}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: "var(--space-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "var(--danger)",
                fontSize: "0.85rem",
                fontWeight: 500,
                animation: "fadeIn 0.3s ease both",
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Supported platforms */}
          <div
            className="platform-badges"
            style={{ marginTop: "var(--space-lg)" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Youtube size={14} /> YouTube
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.9rem" }}>♪</span> TikTok
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Instagram size={14} /> Instagram
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Globe size={14} /> Any website
            </span>
          </div>
        </div>
      </section>

      {/* ── Recipe Grid ── */}
      <section
        style={{
          flex: 1,
          padding: "var(--space-lg) var(--page-padding) var(--space-2xl)",
          maxWidth: "var(--max-width)",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-lg)",
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>
              {recipes.length > 0 ? "Your Recipes" : "Try a Demo Recipe"}
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--warm-gray)" }}>
              {recipes.length > 0
                ? "Recently extracted recipes"
                : "Click any recipe below to see it in action"}
            </p>
          </div>
          {recipes.length > 0 && demoRecipes.length > 0 && (
            <span
              className="badge badge-platform"
              style={{ fontSize: "0.7rem" }}
            >
              + {demoRecipes.length} demos
            </span>
          )}
        </div>

        {loadingDemos ? (
          <div className="skeleton-grid">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 240, borderRadius: "var(--radius-lg)" }}
              />
            ))}
          </div>
        ) : (
          <div className="recipe-grid">
            {allRecipes.map((recipe, idx) => (
              <div
                key={recipe.id}
                className="animate-in"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <RecipeCard
                  recipe={recipe}
                  onClick={() => navigate(`/recipe/${recipe.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── How it Works ── */}
      <section
        style={{
          background: "var(--white)",
          padding: "var(--space-2xl) var(--page-padding)",
          borderTop: "1px solid var(--cream-dark)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ marginBottom: "var(--space-xl)" }}>How it works</h2>
          <div className="how-it-works-grid">
            {[
              {
                icon: <LinkIcon size={26} color="var(--saffron)" />,
                title: "Paste a Link",
                desc: "Drop any recipe URL — YouTube, TikTok, Instagram, or a blog post.",
              },
              {
                icon: <Sparkles size={26} color="var(--terracotta)" />,
                title: "AI Extracts It",
                desc: "Gemini reads the content and structures a clean recipe with ingredients & steps.",
              },
              {
                icon: <Mic size={26} color="var(--olive)" />,
                title: "Cook with Voice",
                desc: "Start cooking and talk to YesChef. It guides you step by step, hands-free.",
              },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-md)",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--cream)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {step.icon}
                </div>
                <h4>{step.title}</h4>
                <p style={{ fontSize: "0.88rem", maxWidth: 280 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "var(--space-lg) var(--page-padding)",
          paddingBottom: "calc(var(--space-lg) + var(--safe-bottom))",
          borderTop: "1px solid var(--cream-dark)",
          fontSize: "0.78rem",
          color: "var(--warm-gray-lt)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ChefHat size={14} />
          YesChef — Built with Gemini &amp; LiveKit
        </span>
      </footer>
    </div>
  );
}
