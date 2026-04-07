import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshStore } from "./loader";

const tempDirs = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "scoutplan-adapter-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("loader", () => {
  it("loads imports, applies aliases and writes store", async () => {
    const root = await makeTempDir();
    const importsDir = join(root, "imports");
    const dataDir = join(root, "data");

    await mkdir(importsDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });

    const aliasesFile = join(dataDir, "aliases.json");
    const storeFile = join(dataDir, "store.json");
    const sampleFile = join(dataDir, "sample.json");

    await writeFile(aliasesFile, JSON.stringify({ "Fortuna Dusseldorf U19": "Fortuna Düsseldorf (U)" }), "utf8");
    await writeFile(
      join(importsDir, "samstag.csv"),
      "date,time,home,away,kreisId,jugendId\n2026-04-04,10:00,Fortuna Dusseldorf U19,Team B,duesseldorf,d-jugend",
      "utf8",
    );
    await writeFile(sampleFile, JSON.stringify({ games: [] }), "utf8");

    const result = await refreshStore({
      aliasesFile,
      importDir: importsDir,
      sampleFile,
      storeFile,
      remoteUrl: "",
      remoteToken: "",
    });

    expect(result.games).toHaveLength(1);
    expect(result.games[0].home).toBe("Fortuna Düsseldorf (U)");

    const storeRaw = JSON.parse(await readFile(storeFile, "utf8"));
    expect(storeRaw.games).toHaveLength(1);
    expect(storeRaw.meta.counts.imports).toBe(1);
  });

  it("falls back to sample when imports are empty", async () => {
    const root = await makeTempDir();
    const importsDir = join(root, "imports");
    const dataDir = join(root, "data");

    await mkdir(importsDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });

    const storeFile = join(dataDir, "store.json");
    const sampleFile = join(dataDir, "sample.json");

    await writeFile(
      sampleFile,
      JSON.stringify({ games: [{ home: "Team A", away: "Team B", date: "2026-04-04", time: "11:00" }] }),
      "utf8",
    );

    const result = await refreshStore({
      aliasesFile: "",
      importDir: importsDir,
      sampleFile,
      storeFile,
      remoteUrl: "",
      remoteToken: "",
    });

    expect(result.games).toHaveLength(1);
    expect(result.meta.warnings.some((msg) => msg.includes("Sample-Fallback"))).toBe(true);
  });

  it("times out remote source requests and keeps service functional", async () => {
    const root = await makeTempDir();
    const importsDir = join(root, "imports");
    const dataDir = join(root, "data");

    await mkdir(importsDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });

    const storeFile = join(dataDir, "store.json");
    const sampleFile = join(dataDir, "sample.json");

    await writeFile(
      sampleFile,
      JSON.stringify({ games: [{ home: "Team Timeout A", away: "Team Timeout B", date: "2026-04-05", time: "11:00" }] }),
      "utf8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) =>
        new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
      ),
    );

    const resultPromise = refreshStore({
      aliasesFile: "",
      importDir: importsDir,
      sampleFile,
      storeFile,
      remoteUrl: "https://example.com/games.json",
      remoteToken: "",
      remoteTimeoutMs: 30,
    });

    const result = await resultPromise;

    expect(result.games).toHaveLength(1);
    expect(result.meta.warnings.some((msg) => msg.includes("Timeout"))).toBe(true);
  });
});
