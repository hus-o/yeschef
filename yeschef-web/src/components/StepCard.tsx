import { Clock, Lightbulb, CheckCircle2 } from "lucide-react";
import type { Step } from "../store/recipeStore";

interface StepCardProps {
  step: Step;
  isActive: boolean;
  isCompleted?: boolean;
}

export default function StepCard({
  step,
  isActive,
  isCompleted = false,
}: StepCardProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-lg)",
        padding: "var(--space-lg)",
        background: isActive ? "rgba(232,148,10,0.04)" : "var(--white)",
        borderRadius: "var(--radius-md)",
        border: isActive
          ? "1.5px solid var(--saffron)"
          : "1px solid var(--cream-dark)",
        transition: "all 0.2s var(--ease-out)",
        opacity: isCompleted && !isActive ? 0.6 : 1,
        boxShadow: isActive ? "var(--shadow-sm)" : "none",
      }}
    >
      {/* Step number circle */}
      <div
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem",
          fontWeight: 700,
          flexShrink: 0,
          background: isCompleted
            ? "var(--olive)"
            : isActive
              ? "var(--saffron)"
              : "var(--cream-dark)",
          color:
            isCompleted || isActive ? "var(--white)" : "var(--charcoal-mid)",
          transition: "all 0.2s ease",
        }}
      >
        {isCompleted ? <CheckCircle2 size={18} /> : step.number}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.7,
            color: "var(--charcoal)",
            marginBottom: step.duration || step.tip ? "var(--space-sm)" : 0,
          }}
        >
          {step.instruction}
        </p>

        {step.duration && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--saffron)",
              background: "rgba(232,148,10,0.08)",
              padding: "2px 10px",
              borderRadius: "var(--radius-full)",
              marginBottom: step.tip ? "var(--space-sm)" : 0,
            }}
          >
            <Clock size={12} />
            {step.duration}
          </div>
        )}

        {step.tip && (
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "var(--space-sm) var(--space-md)",
              background: "rgba(107,127,78,0.06)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.82rem",
              color: "var(--olive)",
              lineHeight: 1.5,
              alignItems: "flex-start",
              marginTop: 4,
            }}
          >
            <Lightbulb size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{step.tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}
