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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function assertEmail(value) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("E-Mail-Adresse ist ungültig.");
  }
  return email;
}

function assertRole(value) {
  const role = normalizeId(value);
  if (!["admin", "coordinator", "scout", "readonly"].includes(role)) {
    throw new Error("Role muss admin|coordinator|scout|readonly sein.");
  }
  return role;
}

function parseOptions(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || "");
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 0) {
      options[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = String(args[index + 1] || "");
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { positional, options };
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
  node adapter-service/scripts/team-accounts.mjs create <userId> <name> [password] [--role admin|coordinator|scout|readonly] [--email email] [--email-verified]
  node adapter-service/scripts/team-accounts.mjs set-role <userId> <admin|coordinator|scout|readonly>
  node adapter-service/scripts/team-accounts.mjs set-password <userId> <password>
  node adapter-service/scripts/team-accounts.mjs set-email <userId> <email> [--email-verified]
  node adapter-service/scripts/team-accounts.mjs verify-email <userId>
  node adapter-service/scripts/team-accounts.mjs activate <userId>
  node adapter-service/scripts/team-accounts.mjs deactivate <userId>

  TEAM_ACCOUNT_PASSWORD kann statt [password] genutzt werden, damit kein Klartext im Shell-Befehl steht.`);
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
      const email = account.email ? `${account.email}:${account.emailVerified === false ? "unverified" : "verified"}` : "-";
      console.log(`${account.id}\t${account.name}\t${account.role}\t${account.active === false ? "inactive" : "active"}\t${email}`);
    }
    return;
  }

  if (command === "create") {
    const { positional, options } = parseOptions(args);
    const [rawUserId, rawName, rawPassword] = positional;
    const userId = normalizeId(rawUserId);
    const name = String(rawName || "").trim();
    const password = String(rawPassword || process.env.TEAM_ACCOUNT_PASSWORD || "");
    if (!userId || !name || password.length < 8) {
      throw new Error("create erwartet: <userId> <name> <password>=mind.8 oder TEAM_ACCOUNT_PASSWORD.");
    }
    if (findAccount(state, userId)) {
      throw new Error(`Account '${userId}' existiert bereits.`);
    }
    const email = options.email ? assertEmail(options.email) : "";
    const emailVerified = email ? Boolean(options["email-verified"]) : true;
    const role = options.role ? assertRole(options.role) : "scout";
    const now = new Date().toISOString();
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: [
          ...(state.team?.accounts || []),
          {
            id: userId,
            name,
            email,
            emailVerified,
            emailVerificationTokenHash: "",
            emailVerificationExpiresAt: "",
            emailVerifiedAt: emailVerified && email ? now : "",
            role,
            teamId: state.team?.id || "team-scoutx",
            active: true,
            passwordHash: hashPassword(password),
          },
        ],
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Created account '${userId}' with role ${role}${email ? ` and ${emailVerified ? "verified" : "unverified"} email ${email}` : ""}.`);
    return;
  }

  if (command === "set-role") {
    const [rawUserId, rawRole] = args;
    const userId = normalizeId(rawUserId);
    const role = assertRole(rawRole);
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

  if (command === "set-email") {
    const { positional, options } = parseOptions(args);
    const [rawUserId, rawEmail] = positional;
    const userId = normalizeId(rawUserId);
    const email = assertEmail(rawEmail);
    const existing = findAccount(state, userId);
    if (!existing) {
      throw new Error(`Account '${userId}' nicht gefunden.`);
    }
    const emailExists = (state.team?.accounts || []).some((account) => account.id !== userId && normalizeEmail(account.email) === email);
    if (emailExists) {
      throw new Error(`E-Mail '${email}' ist bereits vergeben.`);
    }
    const emailVerified = Boolean(options["email-verified"]);
    const now = new Date().toISOString();
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: (state.team?.accounts || []).map((account) =>
          account.id === userId
            ? {
                ...account,
                email,
                emailVerified,
                emailVerificationTokenHash: "",
                emailVerificationExpiresAt: "",
                emailVerifiedAt: emailVerified ? now : "",
              }
            : account,
        ),
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Updated email for '${userId}' => ${email} (${emailVerified ? "verified" : "unverified"}).`);
    return;
  }

  if (command === "verify-email") {
    const [rawUserId] = args;
    const userId = normalizeId(rawUserId);
    const existing = findAccount(state, userId);
    if (!existing) {
      throw new Error(`Account '${userId}' nicht gefunden.`);
    }
    if (!existing.email) {
      throw new Error(`Account '${userId}' hat keine E-Mail-Adresse.`);
    }
    const now = new Date().toISOString();
    const next = {
      ...state,
      team: {
        ...state.team,
        accounts: (state.team?.accounts || []).map((account) =>
          account.id === userId
            ? {
                ...account,
                emailVerified: true,
                emailVerificationTokenHash: "",
                emailVerificationExpiresAt: "",
                emailVerifiedAt: account.emailVerifiedAt || now,
              }
            : account,
        ),
      },
    };
    await writeTeamState(TEAM_STATE_FILE, next);
    console.log(`Verified email for '${userId}'.`);
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
