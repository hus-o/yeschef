import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
  useVoiceAssistant,
  useLocalParticipant,
  VideoTrack,
} from "@livekit/components-react";
import { RoomEvent, Track, type VideoCaptureOptions } from 'livekit-client';
import "@livekit/components-styles";
import {
  ChefHat,
  ArrowLeft,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  Volume2,
  Clock,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { api } from "../services/api";
import { useRecipeStore, type Recipe } from "../store/recipeStore";

/* ── Saved Session helpers (localStorage, 4-hour expiry) ── */
interface SavedSession {
  recipeId: string;
  currentStep: number; // 0-indexed
  elapsedSeconds: number;
  pausedAt: number; // Date.now()
}

const SESSION_KEY_PREFIX = "yeschef-session-";
const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

function getSavedSession(recipeId: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY_PREFIX + recipeId);
    if (!raw) return null;
    const s: SavedSession = JSON.parse(raw);
    if (Date.now() - s.pausedAt > SESSION_EXPIRY_MS) {
      localStorage.removeItem(SESSION_KEY_PREFIX + recipeId);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(session: SavedSession) {
  localStorage.setItem(
    SESSION_KEY_PREFIX + session.recipeId,
    JSON.stringify(session),
  );
}

function clearSavedSession(recipeId: string) {
  localStorage.removeItem(SESSION_KEY_PREFIX + recipeId);
}

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
  const [fetchingToken, setFetchingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [resumeFromStep, setResumeFromStep] = useState<number | null>(null);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  // Guards against rapid double-clicks firing multiple token requests
  const fetchingTokenRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    const init = async () => {
      let r = recipes.find((rec) => rec.id === id) || null;

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

      setRecipe(r);
      setLoading(false);

      // Check for a saved (paused) session
      const saved = getSavedSession(id);
      if (saved) setSavedSession(saved);
    };

    init();
  }, [id, recipes]);

  const startVoiceSession = useCallback(async () => {
    if (!id) return;

    // Prevent concurrent sequences (e.g. rapid double-click)
    if (fetchingTokenRef.current) return;
    fetchingTokenRef.current = true;

    setFetchingToken(true);
    setError(null);
    setRetryAttempt(0);

    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        setRetryAttempt(attempt);
        try {
          const tkn = await api.getLiveToken(id, resumeFromStep ?? undefined);
          setTokenData(tkn);
          return;
        } catch (err: any) {
          console.error(`Token fetch attempt ${attempt} failed:`, err);

          // Stop immediately on 429 (don't waste retries)
          if (err?.status === 429) {
            setError(
              "Rate limited — please wait a minute before starting a new session.",
            );
            return;
          }

          if (attempt === 3) {
            setError(
              err?.message || "Failed to start voice session after 3 attempts.",
            );
            return;
          }

          // Exponential backoff: 1s, 2s
          await wait(1000 * attempt);
        }
      }
    } finally {
      fetchingTokenRef.current = false;
      setFetchingToken(false);
    }
  }, [id]);

  const handleEndSession = useCallback(() => {
    if (id) clearSavedSession(id);
    setSessionEnded(true);
    setTimeout(() => navigate(`/recipe/${id}`), 300);
  }, [id, navigate]);

  const handlePauseSession = useCallback(() => {
    // The CookUI's beforeunload will also fire, but we save here explicitly
    // so user gets immediate feedback. CookUI exposes step/elapsed via ref.
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
          <ChefHat size={48} color="var(--saffron)" />
          <h2
            style={{
              marginTop: "var(--space-md)",
              fontFamily: "var(--font-display)",
            }}
          >
            {savedSession ? "Session Paused" : "Ready to Cook?"}
          </h2>
          <p
            style={{
              color: "var(--charcoal-mid)",
              maxWidth: 340,
              textAlign: "center",
              fontSize: "0.95rem",
              marginTop: "var(--space-sm)",
              lineHeight: 1.6,
            }}
          >
            {savedSession ? (
              <>
                You paused <strong>{recipe.title}</strong> at{" "}
                <strong>step {savedSession.currentStep + 1}</strong> of{" "}
                {recipe.steps.length}.
              </>
            ) : (
              <>
                Start your voice session to cook <strong>{recipe.title}</strong>{" "}
                with YesChef assistant.
              </>
            )}
          </p>

          <div
            style={{
              marginTop: "var(--space-xl)",
              width: "100%",
              maxWidth: 300,
            }}
          >
            {savedSession ? (
              <>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    setResumeFromStep(savedSession.currentStep + 1); // 1-indexed for backend
                    startVoiceSession();
                  }}
                  disabled={fetchingToken}
                  style={{ width: "100%", gap: 10 }}
                >
                  {fetchingToken ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      Resume from Step {savedSession.currentStep + 1}
                    </>
                  )}
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (id) clearSavedSession(id);
                    setSavedSession(null);
                    setResumeFromStep(null);
                    startVoiceSession();
                  }}
                  disabled={fetchingToken}
                  style={{ width: "100%", marginTop: "var(--space-sm)" }}
                >
                  Start Fresh
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={startVoiceSession}
                disabled={fetchingToken}
                style={{ width: "100%", gap: 10 }}
              >
                {fetchingToken ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {retryAttempt > 1
                      ? `Retrying (${retryAttempt}/3)...`
                      : "Connecting..."}
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    Start Voice Session
                  </>
                )}
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => navigate(`/recipe/${id}`)}
              disabled={fetchingToken}
              style={{ width: "100%", marginTop: "var(--space-sm)" }}
            >
              Back to Recipe
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: "var(--space-lg)",
                padding: "var(--space-md)",
                background: "rgba(217,79,79,0.08)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(217,79,79,0.2)",
                color: "var(--danger)",
                fontSize: "0.85rem",
                maxWidth: 320,
              }}
            >
              <div
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <AlertCircle
                  size={16}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>{error}</span>
              </div>
            </div>
          )}
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
        videoCaptureDefaults: {
          resolution: { width: 768, height: 768, frameRate: 10 },
        },
      }}
    >
      <RoomAudioRenderer />
      <CookUI
        recipe={recipe}
        onEnd={handleEndSession}
        onPause={handlePauseSession}
        initialStep={savedSession?.currentStep ?? 0}
        initialElapsed={savedSession?.elapsedSeconds ?? 0}
      />
    </LiveKitRoom>
  );
}

/* ═══════════════════════════════════════════════════════════
   CookUI — Mobile-first cook screen inside LiveKitRoom
   ═══════════════════════════════════════════════════════════ */

function CookUI({
  recipe,
  onEnd,
  onPause,
  initialStep,
  initialElapsed,
}: {
  recipe: Recipe;
  onEnd: () => void;
  onPause: () => void;
  initialStep: number;
  initialElapsed: number;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const voiceAssistant = useVoiceAssistant();
  const { localParticipant, cameraTrack } = useLocalParticipant();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flipPending, setFlipPending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs so beforeunload/visibility callbacks see latest values
  const stepRef = useRef(currentStep);
  const elapsedRef = useRef(elapsedSeconds);
  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);
  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // inside CookUI(...)
  useEffect(() => {
    if (!room) return;

    const tag = '[LK]';

    const onLocalPub = (pub: any) => console.log(tag, 'LocalTrackPublished', {
      sid: pub?.trackSid,
      source: pub?.source,
      kind: pub?.kind,
      muted: pub?.isMuted,
    });

    const onLocalUnpub = (pub: any) => console.log(tag, 'LocalTrackUnpublished', {
      sid: pub?.trackSid,
      source: pub?.source,
      kind: pub?.kind,
    });

    const onTrackMuted = (pub: any, participant: any) =>
      console.log(tag, 'TrackMuted', { source: pub?.source, sid: pub?.trackSid, who: participant?.identity });

    const onTrackUnmuted = (pub: any, participant: any) =>
      console.log(tag, 'TrackUnmuted', { source: pub?.source, sid: pub?.trackSid, who: participant?.identity });

    room.on(RoomEvent.LocalTrackPublished, onLocalPub);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpub);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onLocalPub);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpub);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
    };
  }, [room]);

  // Auto-save session on tab close / visibility hidden
  useEffect(() => {
    const persist = () => {
      saveSession({
        recipeId: recipe.id,
        currentStep: stepRef.current,
        elapsedSeconds: elapsedRef.current,
        pausedAt: Date.now(),
      });
    };

    const handleBeforeUnload = () => persist();
    const handleVisChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisChange);
    };
  }, [recipe.id]);

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

  const sendControl = useCallback(
    (msg: any) => {
      try {
        if (!room) return;
        if (connectionState !== "connected") return;

        const payload = new TextEncoder().encode(JSON.stringify(msg));
        room.localParticipant.publishData(payload, { reliable: true, topic: "yeschef" });
      } catch (e) {
        console.warn("[UI] publishData failed", e);
      }
    },
    [room, connectionState]
  );

  useEffect(() => {
    sendControl({ type: "camera_state", on: cameraOn, ts: Date.now() });
  }, [cameraOn, sendControl]);

  const toggleMute = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.error("Mic toggle failed:", err);
    }
  }, [room, isMuted]);

  const toggleCamera = useCallback(async () => {
    const newState = !cameraOn;

    console.log("[UI] toggleCamera click", {
      from: cameraOn,
      to: newState,
      cameraTrackSid: cameraTrack?.trackSid,
      cameraTrackMuted: cameraTrack?.isMuted,
    });

    try {
      if (newState) {
        const opts: VideoCaptureOptions = {
          resolution: { width: 768, height: 768 },
          frameRate: 10,
          facingMode,
        };

        await localParticipant.setCameraEnabled(true, opts);

        console.log("[UI] setCameraEnabled done", {
          cameraTrackSid: cameraTrack?.trackSid,
          cameraTrackMuted: cameraTrack?.isMuted,
        });

        setCameraOn(true);
        sendControl({ type: "camera_state", on: true, ts: Date.now() });
      } else {
        await localParticipant.setCameraEnabled(false);
        setCameraOn(false);
        sendControl({ type: "camera_state", on: false, ts: Date.now() });
      }
    } catch (err) {
      console.error("Camera toggle failed:", err);
    }
  }, [localParticipant, cameraOn, facingMode, cameraTrack, sendControl]);


  const flipCamera = useCallback(async () => {
    const next: "environment" | "user" = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);

    // If camera is currently off, just store the preference for next time.
    if (!cameraOn) return;
    if (!room) return;

    setFlipPending(true);
    try {
      // Unpublish current camera track so LiveKit has to create a new one with new constraints.
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;

      if (track) {
        await room.localParticipant.unpublishTrack(track);
        // Stop the capturer if possible (prevents the old camera staying “alive”).
        (track as any).stop?.();
      }

      const opts: VideoCaptureOptions = {
        resolution: { width: 768, height: 768 },
        frameRate: 10,
        facingMode: next,
      };

      await room.localParticipant.setCameraEnabled(true, opts);
      setCameraOn(true);
    } catch (err) {
      console.error("Flip camera failed:", err);
    } finally {
      setFlipPending(false);
    }
  }, [room, cameraOn, facingMode]);


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
          onClick={() => {
            if (
              window.confirm("End session? Your progress will not be saved.")
            ) {
              clearSavedSession(recipe.id);
              onEnd();
            }
          }}
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
          <PhoneOff size={14} color="var(--danger)" />
          <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>
            End
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
                      ? "100%"
                      : agentListening
                        ? "40%"
                        : "4px",
                    animation:
                      agentSpeaking || agentListening
                        ? `bar-pulse ${0.5 + (i % 7) * 0.1}s ease-in-out ${(i % 4) * 0.1}s infinite`
                        : "none",
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

      {/* ── Local Camera Preview (fixed corner, shown when camera is on) ── */}
      {cameraOn && cameraTrack && (
        <div
          style={{
            position: "fixed",
            bottom: 200,
            right: 16,
            width: 120,
            height: 120,
            borderRadius: 16,
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 50,
            background: "#000",
          }}
        >
          <VideoTrack
            trackRef={{ participant: localParticipant, publication: cameraTrack, source: cameraTrack.source }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(217,79,79,0.85)",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.05em",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#fff",
                animation: "pulse 1.5s ease infinite",
              }}
            />
            LIVE
          </div>
        </div>
      )}

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
        {/* Mic + Camera row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Camera toggle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={flipCamera}
                disabled={!cameraOn || flipPending}
                style={{
                  marginTop: 8,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: !cameraOn || flipPending ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,0.10)",
                  opacity: !cameraOn || flipPending ? 0.4 : 1,
                }}
                aria-label="Flip camera"
                title="Flip camera"
              >
                <RefreshCcw size={18} />
              </button>

              <button
                onClick={toggleCamera}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  color: "var(--white)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: cameraOn
                    ? "linear-gradient(135deg, var(--olive), var(--olive-light))"
                    : "rgba(255,255,255,0.1)",
                  boxShadow: cameraOn
                    ? "0 4px 16px rgba(107,142,35,0.4)"
                    : "none",
                }}
              >
                {cameraOn ? <Camera size={22} /> : <CameraOff size={22} />}
              </button>
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                }}
              >
                {cameraOn ? "Camera on" : "Camera"}
              </span>
            </div>
          </div>
          {/* Mic toggle (primary, larger) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
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
                fontSize: "0.68rem",
                fontWeight: 500,
              }}
            >
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </div>

          {/* End session (small circle) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <button
              onClick={() => {
                // Save session before pausing
                saveSession({
                  recipeId: recipe.id,
                  currentStep,
                  elapsedSeconds,
                  pausedAt: Date.now(),
                });
                onPause();
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                color: "var(--white)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: "rgba(232,148,10,0.15)",
              }}
            >
              <Pause size={22} color="var(--saffron)" />
            </button>
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.65rem",
                fontWeight: 500,
              }}
            >
              Pause
            </span>
          </div>
        </div>
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
