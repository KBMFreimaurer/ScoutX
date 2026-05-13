#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readTeamState, writeTeamState } from "../lib/teamBackend.js";

const TEAM_STATE_FILE =
  process.env.ADAPTER_TEAM_STATE_FILE || fileURLToPath(new URL("../data/team-state.json", import.meta.url));

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashPassword(password) {
  const iterations = 210000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(String(password || ""), salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

function usage() {
  console.log(`Usage:
  node adapter-service/scripts/team-accounts.mjs list
  node adapter-service/scripts/team-accounts.mjs create <userId> <name> <password>
  node adapter-service/scripts/team-accounts.mjs set-role <userId> <admin|coordinator|scout|readonly>
  node adapter-service/scripts/team-accounts.mjs set-password <userId> <password>
  node adapter-service/scripts/team-accounts.mjs activate <userId>
  node adapter-service/scripts/team-accounts.mjs deactivate <userId>`);
}

function findAccount(state, userId) {
  const id = normalizeId(userId);
  return (state.team?.accounts || []).find((item) => item.id === id) || null;
}

async function main() {
  const [, , command, ...args] = process.argv;
  const state = await readTeamState(TEAM_STATE_FILE);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "list") {
    const accounts = Array.isArray(state.team?.accounts) ? state.team.accounts : [];
    for (const account of accounts) {
      console.log(`${account.id}\t${account.name}\t${account.role}\t${account.active === false ? "inactive" : "active"}`);
    }
    return;
  }

  if (command === "create") {
    const [rawUserId, rawName, rawPassword] = args;
    const userId = normalizeId(rawUserId);
    const name = String(rawName || "").trim();
    const password = String(rawPassword || "");
    if (!userId || !name || password.length < 8) {
      throw new Error("create erwartet: <userId> <name> <password>=mind.8");
    }
    if (findAccount(state, userId)) {
      throw new Error(`Account '${userId}' existiert bereits.`);
    }
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: [
          ...(state.team?.accounts || []),
          {
            id: userId,
            name,
            role: "scout",
            teamId: state.team?.id || "team-scoutx",
            active: true,
            passwordHash: hashPassword(password),
          },
        ],
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Created account '${userId}' with role scout.`);
    return;
  }

  if (command === "set-role") {
    const [rawUserId, rawRole] = args;
    const userId = normalizeId(rawUserId);
    const role = normalizeId(rawRole);
    if (!["admin", "coordinator", "scout", "readonly"].includes(role)) {
      throw new Error("Role muss admin|coordinator|scout|readonly sein.");
    }
    const existing = findAccount(state, userId);
    if (!existing) {
      throw new Error(`Account '${userId}' nicht gefunden.`);
    }
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: (state.team?.accounts || []).map((account) => (account.id === userId ? { ...account, role } : account)),
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Updated role for '${userId}' => ${role}.`);
    return;
  }

  if (command === "set-password") {
    const [rawUserId, rawPassword] = args;
    const userId = normalizeId(rawUserId);
    const password = String(rawPassword || "");
    if (password.length < 8) {
      throw new Error("Passwort muss mindestens 8 Zeichen haben.");
    }
    const existing = findAccount(state, userId);
    if (!existing) {
      throw new Error(`Account '${userId}' nicht gefunden.`);
    }
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: (state.team?.accounts || []).map((account) =>
          account.id === userId ? { ...account, passwordHash: hashPassword(password) } : account,
        ),
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Updated password for '${userId}'.`);
    return;
  }

  if (command === "activate" || command === "deactivate") {
    const [rawUserId] = args;
    const userId = normalizeId(rawUserId);
    const existing = findAccount(state, userId);
    if (!existing) {
      throw new Error(`Account '${userId}' nicht gefunden.`);
    }
    const active = command === "activate";
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: (state.team?.accounts || []).map((account) => (account.id === userId ? { ...account, active } : account)),
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`${active ? "Activated" : "Deactivated"} '${userId}'.`);
    return;
  }

  throw new Error(`Unbekannter command '${command}'`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

