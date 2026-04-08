import { describe, expect, it } from "vitest";
import { computeVisibleChainTotals, extractReasonMap, inferBadges, parseRouteStops, sanitizePlanText } from "./sections";

describe("pdf/sections", () => {
  it("bereinigt Plantext gemäß Ausgabe-Regeln", () => {
    const input = `
VALIDIERUNG
### 1. TOP SPIELE
Spiel 1: Team A vs. Team B
Begründung: Sehr gut. Zweiter Satz. Dritter Satz.
Beobachtungspunkte
- Technik
- Taktik
`;

    const cleaned = sanitizePlanText(input);
    expect(cleaned).not.toMatch(/VALIDIERUNG/i);
    expect(cleaned).not.toMatch(/Beobachtungspunkte/i);
    expect(cleaned).toMatch(/Begründung: Sehr gut\./);
  });

  it("extrahiert Begründungen pro Matchup", () => {
    const plan = `
1. Team A vs. Team B | Platz 1
Begründung: Starkes Spiel für Vergleich auf gutem Niveau.
`;

    const map = extractReasonMap(plan);
    const values = [...map.values()];
    expect(values.length).toBeGreaterThan(0);
    expect(values.join(" ")).toContain("Starkes Spiel");
  });

  it("leitet Route aus Plantext ab und fallbackt auf Spiele", () => {
    const games = [
      { home: "Team A", away: "Team B", time: "10:00", venue: "Platz 1", date: "2026-04-11" },
      { home: "Team C", away: "Team D", time: "12:00", venue: "Platz 2", date: "2026-04-11" },
      { home: "Team E", away: "Team F", time: "14:00", venue: "Platz 3", date: "2026-04-11" },
    ];
    const fromPlan = parseRouteStops("10:00 - Team A vs. Team B | Platz 1", games);
    expect(fromPlan).toHaveLength(1);
    expect(fromPlan[0].label).toContain("Team A");
    expect(fromPlan[0].label).toContain("Team B");

    const fallback = parseRouteStops("", games);
    expect(fallback).toHaveLength(3);
    expect(fallback[0].time).toBe("10:00");
  });

  it("bildet Badge-Set aus Priorität und Begründung", () => {
    const tags = inferBadges({ priority: 5 }, "Leistungsklasse, Jahrgang gemischt");
    expect(tags).toContain("NLZ-relevant");
    expect(tags).toContain("Leistungsklasse");
    expect(tags).toContain("Jahrgang gemischt");
  });

  it("berechnet Gesamtkette nur aus sichtbaren Segmenten", () => {
    const totals = computeVisibleChainTotals(
      [{ distanceKm: 50, durationMinutes: 40 }],
      [
        { distanceKm: 10, durationMinutes: 12 },
        { distanceKm: 15, durationMinutes: 18 },
      ],
    );

    expect(totals.totalKm).toBe(75);
    expect(totals.totalMinutes).toBe(70);
  });

  it("setzt Gesamtkette auf unbekannt bei fehlendem Segment", () => {
    const totals = computeVisibleChainTotals(
      [{ distanceKm: 50, durationMinutes: 40 }],
      [{ distanceKm: null, durationMinutes: null }],
    );

    expect(totals.totalKm).toBeNull();
    expect(totals.totalMinutes).toBeNull();
  });
});
