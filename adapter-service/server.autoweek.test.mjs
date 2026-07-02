import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Regression: der Auto-Week-Refresh einer Altersklasse darf bereits
// gescrapte Spiele anderer Altersklassen nicht aus dem Store verwerfen.

const WEEK_DATE = "2026-07-08";

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Adapter noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

describe("adapter-service auto-week refresh across Altersklassen", () => {
  let child = null;
  let baseUrl = "";

  beforeAll(async () => {
    const port = await allocatePort();
    const rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-autoweek-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    // Nicht-leere Basisdaten: so ersetzt der Baseline-Refresh den Store
    // (wie in Produktion mit Import-/Remote-Quellen), statt ihn zu behalten.
    const sampleFile = join(tempDir, "games.sample.json");
    await writeFile(
      sampleFile,
      JSON.stringify([
        {
          home: "MSV Duisburg U13",
          away: "VfB Uerdingen U13",
          date: "2026-05-02",
          time: "11:00",
          venue: "Sportanlage Test",
          kreisId: "duisburg",
          jugendId: "d-jugend",
        },
      ]),
      "utf8",
    );
    await writeFile(join(tempDir, "aliases.json"), JSON.stringify({ aliases: {} }), "utf8");

    // Stub-Exporter: liefert genau ein Spiel für die angefragte Altersklasse.
    const exportScript = join(tempDir, "export-stub.mjs");
    await writeFile(
      exportScript,
      [
        "const jugendId = process.env.SCOUTX_JUGEND_ID || 'unbekannt';",
        `const game = { home: 'Heim ' + jugendId, away: 'Gast ' + jugendId, date: '${WEEK_DATE}', time: '11:00', venue: 'Platz', kreisId: 'duisburg', jugendId, league: 'Leistungsklasse ' + jugendId };`,
        "console.log(JSON.stringify({ games: [game] }));",
      ].join("\n"),
      "utf8",
    );

    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        ADAPTER_HOST: "127.0.0.1",
        ADAPTER_PORT: String(port),
        ADAPTER_TOKEN: "test-token",
        ADAPTER_RATE_LIMIT_MAX: "500",
        ADAPTER_AUTO_REFRESH_WEEK: "true",
        ADAPTER_EXPORT_COMMAND: `node ${exportScript}`,
        ADAPTER_DATA_FILE: sampleFile,
        ADAPTER_STORE_FILE: join(tempDir, "games.store.json"),
        ADAPTER_TEAM_STATE_FILE: join(tempDir, "team-state.json"),
        ADAPTER_IMPORT_DIR: importsDir,
        ADAPTER_ALIASES_FILE: join(tempDir, "aliases.json"),
        ADAPTER_CLUB_CATALOG_FILE: join(tempDir, "clubs.catalog.json"),
        ADAPTER_TEAM_ARCHIVE_FILE: join(tempDir, "team-state.archive.ndjson"),
        ADAPTER_EMAIL_OUTBOX_FILE: join(tempDir, "email-outbox.ndjson"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`);
  }, 30000);

  afterAll(async () => {
    if (!child || child.killed) {
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(resolve, 3000);
    });
  });

  async function postGames(jugendId) {
    const response = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        kreisId: "duisburg",
        jugendId,
        fromDate: WEEK_DATE,
        toDate: WEEK_DATE,
        ensureWeekData: true,
      }),
    });
    expect(response.status).toBe(200);
    return response.json();
  }

  it("keeps games of a previously fetched Altersklasse after refreshing another one", async () => {
    const first = await postGames("a-jugend");
    expect(first.games.map((game) => game.jugendId)).toEqual(["a-jugend"]);

    const second = await postGames("b-jugend");
    expect(second.games.map((game) => game.jugendId)).toEqual(["b-jugend"]);

    // Erneute Anfrage für die erste Altersklasse (Woche gecacht): Spiele
    // dürfen durch den b-jugend-Refresh nicht verloren gegangen sein.
    const again = await postGames("a-jugend");
    expect(again.games.map((game) => game.jugendId)).toEqual(["a-jugend"]);
    expect(again.games[0].league).toBe("Leistungsklasse a-jugend");
  }, 30000);
});
