import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeTeamState } from "../lib/teamBackend.js";

function parseArgs(argv) {
  const args = {
    input: process.env.ADAPTER_TEAM_STATE_FILE || "",
    output: "",
    backup: false,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "").trim();
    if (token === "--input") {
      args.input = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--output") {
      args.output = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--backup") {
      args.backup = true;
      continue;
    }
    if (token === "--check") {
      args.check = true;
      continue;
    }
  }
  return args;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function summarize(normalized) {
  return {
    teamId: String(normalized?.team?.id || ""),
    accountCount: Array.isArray(normalized?.team?.accounts) ? normalized.team.accounts.length : 0,
    manualGames: Array.isArray(normalized?.manualGames) ? normalized.manualGames.length : 0,
    tournaments: Array.isArray(normalized?.tournaments) ? normalized.tournaments.length : 0,
    observations: Array.isArray(normalized?.observations) ? normalized.observations.length : 0,
    notifications: Array.isArray(normalized?.notifications) ? normalized.notifications.length : 0,
    feedItems: Array.isArray(normalized?.feedItems) ? normalized.feedItems.length : 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(String(args.input || "").trim());
  if (!inputPath) {
    throw new Error("Input-Datei fehlt. Nutze --input <pfad> oder ADAPTER_TEAM_STATE_FILE.");
  }
  const outputPath = args.output ? resolve(String(args.output).trim()) : inputPath;

  const rawText = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(rawText);
  const normalized = normalizeTeamState(parsed);
  const nextText = stableJson(normalized);
  const changed = rawText.trimEnd() !== nextText.trimEnd();

  if (args.check) {
    if (changed) {
      console.error("Team-State benötigt Backfill/Normalisierung.");
      process.exitCode = 2;
    } else {
      console.log("Team-State ist bereits normalisiert.");
    }
    console.log(JSON.stringify(summarize(normalized), null, 2));
    return;
  }

  if (changed && args.backup && inputPath === outputPath) {
    const backupPath = `${inputPath}.bak.${Date.now()}`;
    await copyFile(inputPath, backupPath);
    console.log(`Backup geschrieben: ${backupPath}`);
  }

  await writeFile(outputPath, nextText, "utf8");
  console.log(changed ? "Team-State normalisiert und geschrieben." : "Team-State unverändert, Datei neu geschrieben.");
  console.log(JSON.stringify(summarize(normalized), null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
