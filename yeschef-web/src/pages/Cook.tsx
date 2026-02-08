import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  ChefHat,
  ArrowLeft,
  Mic,
  MicOff,
  PhoneOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  Volume2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { api } from "../services/api";
import { useRecipeStore, type Recipe } from "../store/recipeStore";

interface LiveKitTokenData {
  token: string;
  room_name: string;
  livekit_url: string;
}

export default function Cook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipes } = useRecipeStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [tokenData, setTokenData] = useState<LiveKitTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (!id) return;

    const init = async () => {
      let r = recipes.find((rec) => rec.id === id) || null;

      if (!r) {
        try {
          const demoData = await api.getDemoRecipes();
          const demoList = Array.isArray(demoData)
            ? demoData
            : demoData.recipes || [];
          const match = demoList.find(
            (d: Record<string, unknown>) => d.id === id,
          );
          if (match) r = mapApiRecipe(match);
        } catch {
          /* ignore */
        }

        if (!r) {
          try {
            const data = await api.getRecipe(id);
            r = mapApiRecipe(data);
          } catch {
            setError("Could not load recipe");
            setLoading(false);
            return;
          }
        }
      }

      setRecipe(r);

      try {
        const tkn = await api.getLiveToken(id);
        setTokenData(tkn);
      } catch (err) {
        setError(
          `Could not connect to voice session: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }

      setLoading(false);
    };

    init();
  }, [id, recipes]);

  const handleEndSession = useCallback(() => {
    setSessionEnded(true);
    setTimeout(() => navigate(`/recipe/${id}`), 300);
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={fullScreen}>
        <div style={centeredCol}>
          <ChefHat
            size={44}
            color="var(--saffron)"
            style={{ animation: "pulse 2s ease infinite" }}
          />
          <h2 style={{ marginTop: "var(--space-lg)", fontSize: "1.3rem" }}>
            Setting up your kitchen…
          </h2>
          <p
            style={{
              color: "var(--warm-gray)",
              marginTop: "var(--space-sm)",
              fontSize: "0.9rem",
            }}
          >
            Connecting to YesChef AI
          </p>
          <Loader2
            size={20}
            color="var(--saffron)"
            style={{
              marginTop: "var(--space-md)",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div style={fullScreen}>
        <div style={centeredCol}>
          <AlertCircle size={40} color="var(--danger)" />
          <h3 style={{ marginTop: "var(--space-md)" }}>Connection Error</h3>
          <p
            style={{
              color: "var(--warm-gray)",
              maxWidth: 340,
              textAlign: "center",
              fontSize: "0.9rem",
              padding: "0 var(--page-padding)",
            }}
          >
            {error || "Something went wrong"}
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              marginTop: "var(--space-lg)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Go Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div style={fullScreen}>
        <div style={centeredCol}>
          <AlertCircle size={40} color="var(--saffron)" />
          <h3 style={{ marginTop: "var(--space-md)" }}>
            Voice Session Unavailable
          </h3>
          <p
            style={{
              color: "var(--warm-gray)",
              maxWidth: 340,
              textAlign: "center",
              fontSize: "0.9rem",
            }}
          >
            The voice AI requires a running backend. Make sure the backend is up
            at port 8000.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/recipe/${id}`)}
          >
            <ArrowLeft size={16} /> Back to Recipe
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={tokenData.livekit_url}
      token={tokenData.token}
      connect={!sessionEnded}
      audio={true}
      video={false}
      style={{ height: "100dvh", background: "var(--charcoal)" }}
      options={{
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }}
    >
      <RoomAudioRenderer />
      <CookUI recipe={recipe} onEnd={handleEndSession} />
    </LiveKitRoom>
  );
}

/* ═══════════════════════════════════════════════════════════
   CookUI — Mobile-first cook screen inside LiveKitRoom
   ═══════════════════════════════════════════════════════════ */

function CookUI({ recipe, onEnd }: { recipe: Recipe; onEnd: () => void }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const voiceAssistant = useVoiceAssistant();

  const [currentStep, setCurrentStep] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = connectionState === "connected";
  const agentSpeaking = voiceAssistant.state === "speaking";
  const agentListening = voiceAssistant.state === "listening";
  const agentThinking = voiceAssistant.state === "thinking";

  const step = recipe.steps[currentStep] || null;
  const totalSteps = recipe.steps.length;

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(
        () => setElapsedSeconds((s) => s + 1),
        1000,
      );
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleMute = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.error("Mic toggle failed:", err);
    }
  }, [room, isMuted]);

  const prevStep = () => setCurrentStep((s) => Math.max(0, s - 1));
  const nextStep = () => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1));

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, #1E1C19 0%, #2D2A26 50%, #1E1C19 100%)",
        color: "var(--cream)",
        overflow: "hidden",
      }}
    >
      {/* ── Top Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-sm) var(--page-padding)",
          paddingTop: "calc(var(--space-sm) + var(--safe-top))",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <button
          onClick={onEnd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "var(--cream-dark)",
            fontSize: "0.82rem",
            fontWeight: 500,
            cursor: "pointer",
            padding: "8px 4px",
            minHeight: 44,
          }}
        >
          <ArrowLeft size={16} />
          <span style={{ display: "none" }} className="hide-mobile">
            Back
          </span>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--cream)",
            overflow: "hidden",
          }}
        >
          <ChefHat size={16} color="var(--saffron)" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "40vw",
            }}
          >
            {recipe.title}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "var(--warm-gray)",
            fontSize: "0.8rem",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          <Clock size={12} />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "var(--space-md) var(--page-padding)",
          overflow: "auto",
          gap: "var(--space-md)",
        }}
      >
        {/* Step Card */}
        <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
          {/* Step indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-sm)",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--saffron)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Step {currentStep + 1} of {totalSteps}
            </span>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {recipe.steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentStep ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    background:
                      i === currentStep
                        ? "var(--saffron)"
                        : i < currentStep
                          ? "var(--olive)"
                          : "rgba(255,255,255,0.15)",
                    transition: "all 0.3s var(--ease-out)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* The step itself */}
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            {step && (
              <>
                <p
                  style={{
                    fontSize: "clamp(1rem, 3.5vw, 1.2rem)",
                    lineHeight: 1.7,
                    color: "var(--cream)",
                    fontWeight: 400,
                  }}
                >
                  {step.instruction}
                </p>
                {step.duration && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: "var(--space-md)",
                      color: "var(--saffron-light)",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                    }}
                  >
                    <Clock size={14} />
                    {step.duration}
                  </div>
                )}
                {step.tip && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: "var(--space-md)",
                      padding: "var(--space-sm) var(--space-md)",
                      background: "rgba(232,148,10,0.08)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.82rem",
                      color: "var(--saffron-light)",
                      lineHeight: 1.5,
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem" }}>💡</span>
                    <span>{step.tip}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Step navigation — big touch targets */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-sm)",
              marginTop: "var(--space-md)",
            }}
          >
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--cream)",
                fontSize: "0.85rem",
                fontWeight: 500,
                padding: "10px 16px",
                minHeight: 44,
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                opacity: currentStep === 0 ? 0.3 : 1,
                transition: "all 0.2s ease",
              }}
            >
              <ChevronLeft size={18} />
              Prev
            </button>

            <span
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.72rem",
                textAlign: "center",
                flex: 1,
              }}
            >
              Say "next" or "go back"
            </span>

            <button
              onClick={nextStep}
              disabled={currentStep >= totalSteps - 1}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--cream)",
                fontSize: "0.85rem",
                fontWeight: 500,
                padding: "10px 16px",
                minHeight: 44,
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                opacity: currentStep >= totalSteps - 1 ? 0.3 : 1,
                transition: "all 0.2s ease",
              }}
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* ── Voice Status ── */}
        <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
          {/* Connection indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "var(--space-xs)",
            }}
          >
            {isConnected ? (
              <>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--olive-light)",
                    animation: "pulse 2s ease infinite",
                  }}
                />
                <Wifi size={12} color="var(--olive-light)" />
                <span style={{ color: "var(--olive-light)" }}>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={12} color="var(--warm-gray)" />
                <span style={{ color: "var(--warm-gray)" }}>Connecting…</span>
                <Loader2
                  size={10}
                  style={{ animation: "spin 1s linear infinite" }}
                  color="var(--warm-gray)"
                />
              </>
            )}
          </div>

          {/* Audio Visualizer */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-sm) var(--space-md)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 2,
                height: 36,
                alignItems: "flex-end",
                marginBottom: "var(--space-xs)",
              }}
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    borderRadius: 2,
                    background: agentSpeaking
                      ? "var(--saffron)"
                      : agentListening
                        ? "var(--olive-light)"
                        : "rgba(255,255,255,0.1)",
                    height: agentSpeaking
                      ? `${Math.random() * 80 + 20}%`
                      : agentListening
                        ? `${Math.random() * 30 + 10}%`
                        : "4px",
                    transition: agentSpeaking
                      ? "height 0.1s ease"
                      : "height 0.3s ease",
                    alignSelf: "center",
                  }}
                />
              ))}
            </div>
            <div
              style={{ textAlign: "center", fontSize: "0.8rem", minHeight: 18 }}
            >
              {agentSpeaking && (
                <span style={{ color: "var(--saffron)", fontWeight: 600 }}>
                  <Volume2
                    size={12}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 4,
                    }}
                  />
                  YesChef is speaking…
                </span>
              )}
              {agentListening && (
                <span style={{ color: "var(--olive-light)", fontWeight: 500 }}>
                  Listening…
                </span>
              )}
              {agentThinking && (
                <span style={{ color: "var(--warm-gray)" }}>
                  <Loader2
                    size={10}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 4,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Thinking…
                </span>
              )}
              {!agentSpeaking &&
                !agentListening &&
                !agentThinking &&
                isConnected && (
                  <span style={{ color: "var(--warm-gray)" }}>
                    Waiting for YesChef…
                  </span>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Controls (safe area aware) ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-sm)",
          padding: "var(--space-md) var(--page-padding)",
          paddingBottom: "calc(var(--space-md) + var(--safe-bottom))",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggleMute}
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            color: "var(--white)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: isMuted
              ? "var(--danger)"
              : "linear-gradient(135deg, var(--saffron), var(--saffron-glow))",
            boxShadow: isMuted
              ? "0 4px 20px rgba(217,79,79,0.4)"
              : "0 4px 20px rgba(232,148,10,0.4)",
          }}
        >
          {isMuted ? <MicOff size={26} /> : <Mic size={26} />}
        </button>

        <span
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}
        >
          {isMuted ? "Tap to unmute" : "Tap to mute"}
        </span>

        <button
          onClick={onEnd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid rgba(217,79,79,0.3)",
            color: "var(--danger)",
            fontSize: "0.8rem",
            fontWeight: 600,
            padding: "8px 20px",
            minHeight: 40,
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            marginTop: "var(--space-xs)",
            transition: "all 0.2s ease",
          }}
        >
          <PhoneOff size={16} />
          End Session
        </button>
      </div>
    </div>
  );
}

/* ── Shared styles ── */
const fullScreen: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--cream)",
  padding: "var(--page-padding)",
};

const centeredCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  textAlign: "center",
};

// ── Helper to map API recipe ──
function mapApiRecipe(r: Record<string, unknown>): Recipe {
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
