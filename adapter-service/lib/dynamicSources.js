import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);

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

  return template.replace(/\{(fromDate|toDate|kreisId|jugendId)\}/g, (_, key) =>
    encodeURIComponent(String(params[key] || "")),
  );
}

async function fetchWeekTemplateGames({ template, token, params }) {
  if (!template) {
    return { games: [], source: "week-template", warnings: [] };
  }

  const url = buildWeekTemplateUrl(template, params);
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Week source HTTP ${response.status}`);
  }

  const parsed = await response.json();
  return {
    games: parseGamesPayload(parsed),
    source: url,
    warnings: [],
  };
}

async function runExportCommand({ command, timeoutMs, params, importDir }) {
  if (!command) {
    return { games: [], source: "export-command", warnings: [] };
  }

  const env = {
    ...process.env,
    SCOUTPLAN_FROM_DATE: String(params.fromDate || ""),
    SCOUTPLAN_TO_DATE: String(params.toDate || ""),
    SCOUTPLAN_KREIS_ID: String(params.kreisId || ""),
    SCOUTPLAN_JUGEND_ID: String(params.jugendId || ""),
    SCOUTPLAN_TEAMS_JSON: JSON.stringify(Array.isArray(params.teams) ? params.teams : []),
    SCOUTPLAN_IMPORT_DIR: String(importDir || ""),
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
