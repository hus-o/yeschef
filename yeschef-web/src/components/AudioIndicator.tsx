interface AudioIndicatorProps {
  isActive: boolean;
  isSpeaking: boolean;
}

export default function AudioIndicator({
  isActive,
  isSpeaking,
}: AudioIndicatorProps) {
  return (
    <div>
      <span>{isActive ? "🔴 LIVE" : "⚫ Disconnected"}</span>
      {isSpeaking && <span> · YesChef is speaking...</span>}
    </div>
  );
}
