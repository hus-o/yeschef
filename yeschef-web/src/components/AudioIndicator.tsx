import { Mic, Volume2, Wifi, WifiOff } from "lucide-react";

interface AudioIndicatorProps {
  isActive: boolean;
  isSpeaking: boolean;
}

export default function AudioIndicator({
  isActive,
  isSpeaking,
}: AudioIndicatorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-sm) var(--space-md)",
        borderRadius: "var(--radius-full)",
        background: isActive ? "rgba(107,127,78,0.1)" : "rgba(140,133,125,0.1)",
        fontSize: "0.8rem",
        fontWeight: 600,
      }}
    >
      {isActive ? (
        <>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isSpeaking ? "var(--saffron)" : "var(--olive)",
              animation: isSpeaking ? "pulse 1s ease infinite" : "none",
            }}
          />
          {isSpeaking ? (
            <span
              style={{
                color: "var(--saffron)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Volume2 size={13} /> Speaking…
            </span>
          ) : (
            <span
              style={{
                color: "var(--olive)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Mic size={13} /> Listening
            </span>
          )}
        </>
      ) : (
        <span
          style={{
            color: "var(--warm-gray)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <WifiOff size={13} /> Disconnected
        </span>
      )}
    </div>
  );
}
