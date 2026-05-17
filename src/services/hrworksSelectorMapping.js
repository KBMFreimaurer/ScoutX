import defaultMapping from "../../config/hrworks.selectors.json";
import { STORAGE_KEYS } from "../config/storage";

const REQUIRED_KEYS = [
  "travelExpenseButton",
  "newTravelExpenseButton",
  "purposeInput",
  "noteTextarea",
  "dateRangeInput",
  "startTimeInput",
  "endTimeInput",
  "departureLocationSelect",
  "destinationLocationSelect",
  "costCenterSelect",
  "saveButton",
  "nextToReceiptsButton",
];

function normalizeMapping(input) {
  const source = input && typeof input === "object" ? input : {};
  const normalized = {
    version: Number(source.version || 1),
  };

  for (const key of REQUIRED_KEYS) {
    normalized[key] = String(source[key] || "").trim();
  }

  return normalized;
}

export function validateHrworksSelectorMapping(mapping) {
  const normalized = normalizeMapping(mapping);
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (!normalized[key]) {
      errors.push(`Selector fehlt: ${key}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    mapping: normalized,
  };
}

export function readHrworksSelectorMapping() {
  const fallback = normalizeMapping(defaultMapping);
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.hrworksSelectors);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const validated = validateHrworksSelectorMapping(parsed);
    return validated.ok ? validated.mapping : fallback;
  } catch {
    return fallback;
  }
}

export function writeHrworksSelectorMapping(input) {
  const validated = validateHrworksSelectorMapping(input);
  if (!validated.ok) {
    return validated;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.hrworksSelectors, JSON.stringify(validated.mapping));
  }

  return validated;
}

export function getHrworksSelectorMappingTemplate() {
  return normalizeMapping(defaultMapping);
}
