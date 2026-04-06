import { describe, expect, it } from "vitest";
import { calculateRoute, haversineDistance } from "./geo";

describe("geo utils", () => {
  it("berechnet Haversine-Distanz in km", () => {
    const distance = haversineDistance(51.2277, 6.7735, 51.4556, 7.0116);
    expect(distance).toBeGreaterThan(20);
    expect(distance).toBeLessThan(40);
  });

  it("berechnet Route mit Legs und Gesamtdistanz", () => {
    const route = calculateRoute(
      { label: "Start", lat: 51.2, lon: 6.7 },
      [
        { home: "A", away: "B", venueLat: 51.25, venueLon: 6.75 },
        { home: "C", away: "D", venueLat: 51.3, venueLon: 6.8 },
      ],
    );

    expect(route.legs).toHaveLength(3);
    expect(route.totalKm).toBeGreaterThan(0);
    expect(route.estimatedMinutes).toBeGreaterThan(0);
  });
});
