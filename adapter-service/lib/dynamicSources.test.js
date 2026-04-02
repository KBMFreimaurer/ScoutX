import { describe, expect, it } from "vitest";
import { buildWeekTemplateUrl, parseGamesPayload } from "./dynamicSources";

describe("dynamic sources", () => {
  it("builds template url", () => {
    const url = buildWeekTemplateUrl(
      "https://example.com/feed?from={fromDate}&to={toDate}&kreis={kreisId}&jugend={jugendId}",
      {
        fromDate: "2026-03-30",
        toDate: "2026-04-05",
        kreisId: "duesseldorf",
        jugendId: "d-jugend",
      },
    );

    expect(url).toBe(
      "https://example.com/feed?from=2026-03-30&to=2026-04-05&kreis=duesseldorf&jugend=d-jugend",
    );
  });

  it("parses array and object payloads", () => {
    expect(parseGamesPayload([{ home: "A", away: "B" }])).toHaveLength(1);
    expect(parseGamesPayload({ games: [{ home: "A", away: "B" }] })).toHaveLength(1);
    expect(parseGamesPayload({})).toHaveLength(0);
  });
});
