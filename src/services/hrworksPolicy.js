import { STORAGE_KEYS } from "../config/storage";

const DEFAULT_POLICY = {
  defaultCostCenter: "Junioren allgemein (321000)",
  requireSaveConfirmation: true,
  allowDebugScreenshots: false,
  aggregationMode: "",
  finalSaveMode: "",
  requiredFields: {
    purpose: true,
    note: true,
    departureLocation: true,
    destinationLocation: true,
    costCenter: true,
  },
};

const ALLOWED_AGGREGATION_MODES = ["per_day", "combined"];
const ALLOWED_FINAL_SAVE_MODES = ["prefill_only", "auto_save"];

function normalizePolicy(input) {
  const source = input && typeof input === "object" ? input : {};
  const required = source.requiredFields && typeof source.requiredFields === "object" ? source.requiredFields : {};
  const rawAggregationMode = String(source.aggregationMode || "").trim();
  const rawFinalSaveMode = String(source.finalSaveMode || "").trim();
  return {
    defaultCostCenter: String(source.defaultCostCenter || DEFAULT_POLICY.defaultCostCenter).trim(),
    requireSaveConfirmation: source.requireSaveConfirmation !== false,
    allowDebugScreenshots: source.allowDebugScreenshots === true,
    aggregationMode: ALLOWED_AGGREGATION_MODES.includes(rawAggregationMode) ? rawAggregationMode : "",
    finalSaveMode: ALLOWED_FINAL_SAVE_MODES.includes(rawFinalSaveMode) ? rawFinalSaveMode : "",
    requiredFields: {
      purpose: required.purpose !== false,
      note: required.note !== false,
      departureLocation: required.departureLocation !== false,
      destinationLocation: required.destinationLocation !== false,
      costCenter: required.costCenter !== false,
    },
  };
}

export function readHrworksPolicy() {
  if (typeof window === "undefined") {
    return normalizePolicy(DEFAULT_POLICY);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.hrworksPolicy);
    if (!raw) {
      return normalizePolicy(DEFAULT_POLICY);
    }
    return normalizePolicy(JSON.parse(raw));
  } catch {
    return normalizePolicy(DEFAULT_POLICY);
  }
}

export function writeHrworksPolicy(policy) {
  const normalized = normalizePolicy(policy);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.hrworksPolicy, JSON.stringify(normalized));
  }
  return normalized;
}

export function getDefaultHrworksPolicy() {
  return normalizePolicy(DEFAULT_POLICY);
}

export function getMissingHrworksOperationalDecisions(policyInput) {
  const policy = normalizePolicy(policyInput);
  const missing = [];

  if (!policy.aggregationMode) {
    missing.push("Aggregation nicht festgelegt (pro Tag oder Sammelabrechnung).");
  }
  if (!policy.finalSaveMode) {
    missing.push("Finaler Speichermodus nicht festgelegt (nur vorbefüllen oder automatisch speichern).");
  }

  return missing;
}

export function getAllowedHrworksPolicyValues() {
  return {
    aggregationMode: [...ALLOWED_AGGREGATION_MODES],
    finalSaveMode: [...ALLOWED_FINAL_SAVE_MODES],
  };
}
