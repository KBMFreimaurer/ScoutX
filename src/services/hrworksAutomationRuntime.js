export const HRWORKS_AUTOMATION_STEPS = [
  "open_hrworks",
  "wait_for_login",
  "open_travel_management",
  "open_new_expense",
  "fill_form",
  "save_without_destination",
  "save_kilometers",
  "process_route",
  "complete_reports",
  "review_prefill",
  "confirm_save",
  "save",
  "done",
];

const ERROR_MESSAGES = {
  HRWORKS_UNREACHABLE: "HRworks ist aktuell nicht erreichbar.",
  USER_NOT_LOGGED_IN: "Nutzer ist nicht in HRworks eingeloggt.",
  NAVIGATION_FAILED: "Navigation in HRworks fehlgeschlagen.",
  FIELD_NOT_FOUND: "Erwartetes Feld wurde in HRworks nicht gefunden.",
  DROPDOWN_VALUE_NOT_FOUND: "Dropdown-Wert wurde in HRworks nicht gefunden.",
  INVALID_TIME: "Datum/Uhrzeit ist ungültig.",
  COST_CENTER_NOT_FOUND: "Kostenstelle wurde in HRworks nicht gefunden.",
  SAVE_FAILED: "Speichern in HRworks fehlgeschlagen.",
  VALIDATION_FAILED: "HRworks zeigt Validierungsfehler.",
  SECURITY_POLICY_VIOLATION: "HRworks-Sicherheitsrichtlinie verletzt.",
};

export function toHrworksAutomationError(code, details = "") {
  const normalizedCode = String(code || "").trim();
  const message = ERROR_MESSAGES[normalizedCode] || "Unbekannter HRworks-Automation-Fehler.";
  return {
    code: normalizedCode || "UNKNOWN",
    message,
    details: String(details || "").trim(),
  };
}

export function canProceedAutomation(prerequisites) {
  const input = prerequisites && typeof prerequisites === "object" ? prerequisites : {};
  const failures = [];

  if (input.isReachable !== true) {
    failures.push(toHrworksAutomationError("HRWORKS_UNREACHABLE"));
  }
  if (input.isLoggedIn !== true) {
    failures.push(toHrworksAutomationError("USER_NOT_LOGGED_IN"));
  }
  if (input.mappingReady !== true) {
    failures.push(toHrworksAutomationError("FIELD_NOT_FOUND", "Selector-Mapping unvollständig."));
  }
  if (input.requireSaveConfirmation !== true) {
    failures.push(toHrworksAutomationError("SECURITY_POLICY_VIOLATION", "Save-Bestätigung muss aktiv sein."));
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function createAutomationRuntimeSession(payload) {
  const now = new Date().toISOString();
  return {
    id: `hrw-${Date.now()}`,
    planId: String(payload?.planId || ""),
    currentStep: "open_hrworks",
    status: "ready",
    createdAt: now,
    updatedAt: now,
    events: [
      {
        at: now,
        type: "session_created",
        step: "open_hrworks",
      },
    ],
  };
}

export function advanceAutomationStep(session, nextStep) {
  const current = session && typeof session === "object" ? session : null;
  if (!current) {
    return null;
  }

  const step = String(nextStep || "").trim();
  if (!HRWORKS_AUTOMATION_STEPS.includes(step)) {
    return {
      ...current,
      status: "failed",
      updatedAt: new Date().toISOString(),
      events: [
        ...(Array.isArray(current.events) ? current.events : []),
        {
          at: new Date().toISOString(),
          type: "session_failed",
          error: toHrworksAutomationError("NAVIGATION_FAILED", `Unbekannter Schritt: ${step}`),
          step: current.currentStep,
        },
      ],
    };
  }

  const now = new Date().toISOString();
  const status = step === "done" ? "done" : "running";
  return {
    ...current,
    currentStep: step,
    status,
    updatedAt: now,
    events: [
      ...(Array.isArray(current.events) ? current.events : []),
      {
        at: now,
        type: "step_changed",
        step,
      },
    ],
  };
}

export function failAutomationSession(session, code, details = "") {
  const current = session && typeof session === "object" ? session : null;
  if (!current) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    ...current,
    status: "failed",
    updatedAt: now,
    events: [
      ...(Array.isArray(current.events) ? current.events : []),
      {
        at: now,
        type: "session_failed",
        step: current.currentStep,
        error: toHrworksAutomationError(code, details),
      },
    ],
  };
}

export function canCaptureDebugScreenshot({ allowDebugScreenshots = false, userConsent = false } = {}) {
  return allowDebugScreenshots === true && userConsent === true;
}
