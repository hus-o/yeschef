import type { Step } from "../store/recipeStore";

interface StepCardProps {
  step: Step;
  isActive: boolean;
}

export default function StepCard({ step, isActive }: StepCardProps) {
  return (
    <div style={{ opacity: isActive ? 1 : 0.5 }}>
      <h4>Step {step.number}</h4>
      <p>{step.instruction}</p>
      {step.duration && <span>⏱️ {step.duration}</span>}
      {step.tip && <em>💡 {step.tip}</em>}
    </div>
  );
}
