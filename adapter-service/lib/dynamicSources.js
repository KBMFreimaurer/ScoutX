import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);

function createAbortController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs || 30000)));
  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

function parseGamesPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.games)) {
    return payload.games;
  }

  return [];
}

function buildWeekTemplateUrl(template, params) {
  if (!template) {
    return "";
  }

  return template.replace(/\{(fromDate|toDate|kreisId|stateCode|regionName|regionShortCode|jugendId)\}/g, (_, key) =>
    encodeURIComponent(String(params[key] || "")),
  );
}

async function fetchWeekTemplateGames({ template, token, params, timeoutMs = 30000 }) {
  if (!template) {
    return { games: [], source: "week-template", warnings: [] };
  }

  const url = buildWeekTemplateUrl(template, params);
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { controller, clear } = createAbortController(timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Week source HTTP ${response.status}`);
    }

    const parsed = await response.json();
    return {
      games: parseGamesPayload(parsed),
      source: url,
      warnings: [],
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Week source Timeout nach ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clear();
  }
}

async function runExportCommand({ command, timeoutMs, params, importDir }) {
  if (!command) {
    return { games: [], source: "export-command", warnings: [] };
  }

  const env = {
    ...process.env,
    SCOUTX_FROM_DATE: String(params.fromDate || ""),
    SCOUTX_TO_DATE: String(params.toDate || ""),
    SCOUTX_KREIS_ID: String(params.kreisId || ""),
    SCOUTX_STATE_CODE: String(params.stateCode || ""),
    SCOUTX_REGION_NAME: String(params.regionName || ""),
    SCOUTX_REGION_SHORT_CODE: String(params.regionShortCode || ""),
    SCOUTX_FUSSBALLDE_MAPPING_JSON: JSON.stringify(params.fussballDeMapping || null),
    SCOUTX_JUGEND_ID: String(params.jugendId || ""),
    SCOUTX_TEAMS_JSON: JSON.stringify(Array.isArray(params.teams) ? params.teams : []),
    SCOUTX_IMPORT_DIR: String(importDir || ""),
  };

  const { stdout } = await exec(command, {
    env,
    timeout: Number(timeoutMs || 30000),
    maxBuffer: 6 * 1024 * 1024,
  });

  const trimmed = String(stdout || "").trim();
  if (!trimmed) {
    return { games: [], source: "export-command", warnings: ["Export command produced no stdout JSON."] };
  }

  const parsed = JSON.parse(trimmed);
  return {
    games: parseGamesPayload(parsed),
    source: "export-command",
    warnings: [],
  };
}

export { buildWeekTemplateUrl, fetchWeekTemplateGames, parseGamesPayload, runExportCommand };
