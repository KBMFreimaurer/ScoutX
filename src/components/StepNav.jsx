import { STEPS } from "../data/constants";
import { C } from "../styles/theme";

const STEP_LABELS = {
  setup: "Setup",
  games: "Spiele",
  plan: "Plan",
};

const STEP_ICONS = {
  setup: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  games: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  plan: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

export function StepNav({ currentStep, onStepChange, canAccessGames, canAccessPlan, isMobile }) {
  const canAccessStep = (step) => {
    if (step === "setup") return true;
    if (step === "games") return canAccessGames;
    return canAccessPlan;
  };

  return (
    <div style={{
      display: "flex",
      gap: 2,
      alignItems: "center",
      background: "rgba(255,255,255,0.03)",
      borderRadius: 10,
      padding: 3,
    }}>
      {STEPS.map((step, index) => {
        const active = currentStep === step;
        const clickable = canAccessStep(step) && !active;
        const unlocked = canAccessStep(step);

        return (
          <button
            key={step}
            onClick={() => clickable && onStepChange(step)}
            style={{
              padding: isMobile ? "6px 10px" : "7px 14px",
              borderRadius: 8,
              fontSize: isMobile ? 11 : 12,
              fontFamily: "'Inter', sans-serif",
              fontWeight: active ? 600 : 500,
              background: active ? "rgba(0,200,83,0.1)" : "transparent",
              color: active ? C.green : unlocked ? C.grayLight : C.grayDark,
              border: active ? `1px solid ${C.greenBorder}` : "1px solid transparent",
              cursor: clickable ? "pointer" : "default",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {!isMobile && STEP_ICONS[step]}
            <span className="step-label-full">{STEP_LABELS[step]}</span>
            <span className="step-label-short">{STEP_LABELS[step].slice(0, 1)}</span>
          </button>
        );
      })}
    </div>
  );
}
