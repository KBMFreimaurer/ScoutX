import { describe, expect, it } from "vitest";
import { buildFussballMatchUrlFromId, resolveGameMatchUrl } from "./gameLinks";

describe("gameLinks", () => {
  it("nutzt vorhandene absolute matchUrl", () => {
    const url = resolveGameMatchUrl({
      matchUrl: "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
    });

    expect(url).toContain("fussball.de/spiel/");
  });

  it("baut aus relativer URL eine absolute URL", () => {
    const url = resolveGameMatchUrl({
      matchUrl: "/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
    });

    expect(url).toBe("https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ");
  });

  it("baut Fallback-Link aus fussball.de Match-ID", () => {
    const matchId = "02U0CT5KV4000000VS5489BTVUFLAKGJ";
    expect(buildFussballMatchUrlFromId(matchId)).toBe(`https://www.fussball.de/spiel/-/spiel/${matchId}`);
    expect(resolveGameMatchUrl({ id: matchId })).toBe(`https://www.fussball.de/spiel/-/spiel/${matchId}`);
  });

  it("liefert leeren String bei nicht auflösbarer ID", () => {
    expect(resolveGameMatchUrl({ id: "csv-1-team-a-team-b" })).toBe("");
  });
});
