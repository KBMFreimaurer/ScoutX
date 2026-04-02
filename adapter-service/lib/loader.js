import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { dedupeGames, normalizeGames, toLookupKey } from "./games.js";
import { parseCsvRows } from "./csv.js";

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeAliasMap(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const map = {};

  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const alias of value) {
        map[toLookupKey(alias)] = key;
      }
      map[toLookupKey(key)] = key;
      continue;
    }

    map[toLookupKey(key)] = String(value || "").trim() || key;
  }

  return map;
}

async function loadAliases(aliasesFile) {
  if (!aliasesFile || !(await fileExists(aliasesFile))) {
    return {};
  }

  try {
    const raw = await readFile(aliasesFile, "utf8");
    const parsed = JSON.parse(raw);
    const source = parsed.aliases && typeof parsed.aliases === "object" ? parsed.aliases : parsed;
    return normalizeAliasMap(source);
  } catch {
    return {};
  }
}

async function collectFilesRecursive(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursive(fullPath);
      files.push(...nested);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadRowsFromFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const raw = await readFile(filePath, "utf8");

  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.games) ? parsed.games : [];
  }

  if (ext === ".csv") {
    return parseCsvRows(raw);
  }

  return [];
}

async function loadGamesFromFile(filePath, aliasMap) {
  const ext = extname(filePath).toLowerCase();
  if (![".csv", ".json"].includes(ext)) {
    return { games: [], count: 0 };
  }

  const rows = await loadRowsFromFile(filePath);
  const games = normalizeGames(rows, { aliasMap, source: filePath });
  return { games, count: games.length };
}

async function loadImportDirectory(importDir, aliasMap) {
  if (!importDir || !(await fileExists(importDir))) {
    return { games: [], files: [], source: "imports" };
  }

  const files = await collectFilesRecursive(importDir);
  const importedFiles = [];
  const allGames = [];

  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    if (![".csv", ".json"].includes(ext)) {
      continue;
    }

    const { games } = await loadGamesFromFile(filePath, aliasMap);
    importedFiles.push({ file: filePath, count: games.length });
    allGames.push(...games);
  }

  return {
    source: "imports",
    games: allGames,
    files: importedFiles,
  };
}

async function loadRemoteSource(remoteUrl, remoteToken, aliasMap) {
  if (!remoteUrl) {
    return { source: "remote", games: [], files: [] };
  }

  const headers = {};
  if (remoteToken) {
    headers.Authorization = `Bearer ${remoteToken}`;
  }

  const response = await fetch(remoteUrl, { headers });
  if (!response.ok) {
    throw new Error(`Remote source HTTP ${response.status}`);
  }

  const parsed = await response.json();
  const rows = Array.isArray(parsed) ? parsed : parsed.games ?? [];
  const games = normalizeGames(rows, { aliasMap, source: remoteUrl });

  return {
    source: "remote",
    games,
    files: [{ file: remoteUrl, count: games.length }],
  };
}

async function loadSampleFile(sampleFile, aliasMap) {
  if (!sampleFile || !(await fileExists(sampleFile))) {
    return { source: "sample", games: [], files: [] };
  }

  const { games } = await loadGamesFromFile(sampleFile, aliasMap);
  return {
    source: "sample",
    games,
    files: [{ file: sampleFile, count: games.length }],
  };
}

async function readStore(storeFile) {
  if (!storeFile || !(await fileExists(storeFile))) {
    return { games: [], meta: null };
  }

  try {
    const raw = await readFile(storeFile, "utf8");
    const parsed = JSON.parse(raw);
    const games = normalizeGames(parsed.games ?? []);
    return { games, meta: parsed.meta ?? null };
  } catch {
    return { games: [], meta: null };
  }
}

async function writeStore(storeFile, payload) {
  const output = {
    meta: payload.meta ?? {},
    games: payload.games ?? [],
  };

  await mkdir(dirname(storeFile), { recursive: true });
  await writeFile(storeFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function refreshStore(config) {
  const aliasesFile = config.aliasesFile ? resolve(config.aliasesFile) : "";
  const importDir = config.importDir ? resolve(config.importDir) : "";
  const sampleFile = config.sampleFile ? resolve(config.sampleFile) : "";
  const storeFile = config.storeFile ? resolve(config.storeFile) : "";

  const aliasMap = await loadAliases(aliasesFile);
  const warnings = [];

  const importsResult = await loadImportDirectory(importDir, aliasMap);
  let remoteResult = { source: "remote", games: [], files: [] };

  if (config.remoteUrl) {
    try {
      remoteResult = await loadRemoteSource(config.remoteUrl, config.remoteToken, aliasMap);
    } catch (error) {
      warnings.push(error.message || "Remote source failed.");
    }
  }

  const sourceGames = [...importsResult.games, ...remoteResult.games];
  let games = dedupeGames(sourceGames);

  if (games.length === 0) {
    const sampleResult = await loadSampleFile(sampleFile, aliasMap);
    games = dedupeGames(sampleResult.games);
    if (games.length > 0) {
      warnings.push("Keine Import-/Remote-Daten gefunden, Sample-Fallback aktiv.");
    }
  }

  const previousStore = await readStore(storeFile);
  if (games.length === 0 && previousStore.games.length > 0) {
    warnings.push("Keine neuen Daten gefunden, vorhandener Store bleibt aktiv.");
    games = previousStore.games;
  }

  const meta = {
    updatedAt: new Date().toISOString(),
    counts: {
      total: games.length,
      imports: importsResult.games.length,
      remote: remoteResult.games.length,
    },
    files: [...importsResult.files, ...remoteResult.files],
    warnings,
    config: {
      importDir,
      sampleFile,
      remoteConfigured: Boolean(config.remoteUrl),
    },
  };

  await writeStore(storeFile, { meta, games });
  return { games, meta, aliasMap, storeFile };
}

export { readStore, refreshStore, writeStore };
