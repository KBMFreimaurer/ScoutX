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
    <div style={{ display: "flex", gap: isMobile ? 4 : 10, alignItems: "center" }}>
      {STEPS.map((step) => {
        const active = currentStep === step;
        const clickable = canAccessStep(step) && !active;
        const unlocked = canAccessStep(step);

        return (
          <div
            key={step}
            onClick={() => clickable && onStepChange(step)}
            style={{
              padding: isMobile ? "8px 6px" : "10px 6px",
              borderRadius: 0,
              fontSize: isMobile ? 11 : 15,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: active ? 800 : 700,
              background: "transparent",
              color: active ? "#70dd88" : unlocked ? C.offWhite : C.grayDark,
              borderBottom: `2px solid ${active ? "#70dd88" : "transparent"}`,
              cursor: clickable ? "pointer" : "default",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              minHeight: 0,
            }}
          >
            <span className="step-label-full">{STEP_LABELS[step]}</span>
            <span className="step-label-short">{STEP_LABELS[step].slice(0, 1)}</span>
          </div>
        );
      })}
    </div>
  );
}
