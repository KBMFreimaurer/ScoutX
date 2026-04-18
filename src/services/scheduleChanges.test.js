import { describe, expect, it } from "vitest";
import { buildScheduleFingerprint, buildScheduleScopeKey, calculateScheduleDelta } from "./scheduleChanges";

describe("buildScheduleFingerprint", () => {
  it("is stable regardless of game order and ignores non-schedule fields", () => {
    const first = [
      {
        id: "a",
        home: "TSV A",
        away: "SV B",
        date: "2026-04-20",
        time: "12:30",
        venue: "Platz 1",
        distanceKm: 12,
      },
      {
        id: "b",
        home: "TSV C",
        away: "SV D",
        dateObj: new Date("2026-04-21T00:00:00"),
        time: "14:00",
        venue: "Platz 2",
        note: "irrelevant",
      },
    ];

    const second = [
      {
        id: "b",
        home: "TSV C",
        away: "SV D",
        date: "2026-04-21",
        time: "14:00",
        venue: "Platz 2",
      },
      {
        id: "a",
        home: "TSV A",
        away: "SV B",
        date: "2026-04-20",
        time: "12:30",
        venue: "Platz 1",
      },
    ];

    expect(buildScheduleFingerprint(first)).toBe(buildScheduleFingerprint(second));
  });

  it("changes when schedule-relevant fields change", () => {
    const base = [
      {
        home: "TSV A",
        away: "SV B",
        date: "2026-04-20",
        time: "12:30",
        venue: "Platz 1",
      },
    ];
    const changed = [
      {
        home: "TSV A",
        away: "SV B",
        date: "2026-04-20",
        time: "13:15",
        venue: "Platz 1",
      },
    ];

    expect(buildScheduleFingerprint(base)).not.toBe(buildScheduleFingerprint(changed));
  });
});

describe("buildScheduleScopeKey", () => {
  it("builds a normalized scope key for a schedule range", () => {
    expect(
      buildScheduleScopeKey({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-04-20",
        toDate: "2026-04-26",
      }),
    ).toBe("duisburg|d-jugend|2026-04-20|2026-04-26");
  });

  it("returns empty string when required identifiers are missing", () => {
    expect(buildScheduleScopeKey({ kreisId: "", jugendId: "d-jugend", fromDate: "2026-04-20", toDate: "" })).toBe("");
  });

  it("rejects invalid fromDate and falls back invalid toDate to fromDate", () => {
    expect(
      buildScheduleScopeKey({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "31.02.2026",
        toDate: "2026-04-26",
      }),
    ).toBe("");

    expect(
      buildScheduleScopeKey({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-04-20",
        toDate: "31.02.2026",
      }),
    ).toBe("duisburg|d-jugend|2026-04-20|2026-04-20");
  });
});

describe("calculateScheduleDelta", () => {
  it("counts added and removed schedule signatures", () => {
    const previous = ["a", "b", "b", ""].join("\n");
    const next = ["b", "c"].join("\n");

    expect(calculateScheduleDelta(previous, next)).toEqual({
      added: 1,
      removed: 1,
      changed: true,
    });
  });

  it("returns unchanged for identical fingerprints", () => {
    const fingerprint = ["a", "b"].join("\n");

    expect(calculateScheduleDelta(fingerprint, fingerprint)).toEqual({
      added: 0,
      removed: 0,
      changed: false,
    });
  });
});
