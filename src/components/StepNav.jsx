import { STEPS } from "../data/constants";
import { C } from "../styles/theme";

const STEP_LABELS = {
  setup: "Setup",
  games: "Spiele",
  plan: "Plan",
};

export function StepNav({ currentStep, onStepChange, canAccessGames, canAccessPlan, isMobile }) {
  const canAccessStep = (step) => {
    if (step === "setup") return true;
    if (step === "games") return canAccessGames;
    return canAccessPlan;
  };

  return (
    <div style={{ display: "flex", gap: 5 }}>
      {STEPS.map((step, index) => {
        const active = currentStep === step;
        const clickable = canAccessStep(step) && !active;
        const done = canAccessStep(step) && !active;

        return (
          <div
            key={step}
            onClick={() => clickable && onStepChange(step)}
            style={{
              padding: isMobile ? "5px 9px" : "6px 14px",
              borderRadius: 4,
              fontSize: isMobile ? 9 : 11,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: active ? 700 : 600,
              background: active ? C.green : done ? C.greenDim : "transparent",
              color: active ? C.white : done ? C.green : C.grayDark,
              border: `1px solid ${active ? C.green : done ? C.greenDark : C.border}`,
              cursor: clickable ? "pointer" : "default",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              minHeight: 0,
            }}
          >
            {done ? "✓ " : ""}
            <span className="step-label-short">{index + 1}</span>
            <span className="step-label-full">{STEP_LABELS[step]}</span>
          </div>
        );
      })}
    </div>
  );
}
