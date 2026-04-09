import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateDirectStartRoutes, calculateRoute, calculateRouteWithDriving, fetchDrivingRoute, haversineDistance } from "./geo";

describe("geo utils", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("berechnet Haversine-Distanz in km", () => {
    const distance = haversineDistance(51.2277, 6.7735, 51.4556, 7.0116);
    expect(distance).toBeGreaterThan(20);
    expect(distance).toBeLessThan(40);
  });

  it("nutzt exakte Startroute für das erste Leg", () => {
    const route = calculateRoute(
      { label: "Start", lat: 51.2, lon: 6.7 },
      [
        {
          home: "A",
          away: "B",
          venueLat: 51.25,
          venueLon: 6.75,
          fromStartRouteDistanceKm: 25.3,
          fromStartRouteMinutes: 34,
        },
        { home: "C", away: "D", venueLat: 51.3, venueLon: 6.8 },
      ],
    );

    expect(route.legs).toHaveLength(3);
    expect(route.legs[0].distanceKm).toBe(25.3);
    expect(route.legs[0].durationMinutes).toBe(34);
    expect(route.legs[0].source).toBe("route");
    expect(route.totalKm).toBeGreaterThan(25);
    expect(route.estimatedMinutes).toBeGreaterThan(0);
  });

  it("holt Straßenroute und nutzt Cache für identische Koordinaten", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distance: 12500,
            duration: 1800,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const fromPoint = { lat: 51.21001, lon: 6.71001 };
    const toPoint = { lat: 51.31001, lon: 6.81001 };

    const first = await fetchDrivingRoute(fromPoint, toPoint);
    const second = await fetchDrivingRoute(fromPoint, toPoint);

    expect(first?.distanceKm).toBeCloseTo(12.5, 4);
    expect(first?.durationMinutes).toBe(30);
    expect(first?.source).toBe("route");
    expect(second?.distanceKm).toBeCloseTo(12.5, 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("berechnet alle Legs der Route mit Straßenrouting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distance: 10000,
            duration: 900,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const route = await calculateRouteWithDriving(
      { label: "Start", lat: 51.2, lon: 6.7 },
      [
        { home: "A", away: "B", venueLat: 51.25, venueLon: 6.75 },
        { home: "C", away: "D", venueLat: 51.3, venueLon: 6.8 },
      ],
    );

    expect(route.legs).toHaveLength(3);
    expect(route.legs[0].source).toBe("route");
    expect(route.legs[1].source).toBe("route");
    expect(route.legs[2].source).toBe("route");
    expect(route.totalKm).toBeCloseTo(30, 4);
    expect(route.estimatedMinutes).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("verhindert OSRM-Fallback wenn requireGoogle aktiv ist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const fromPoint = { lat: 51.20001, lon: 6.70001 };
    const toPoint = { lat: 51.30001, lon: 6.80001 };

    const strictResult = await fetchDrivingRoute(fromPoint, toPoint, { requireGoogle: true });

    expect(strictResult).toBeNull();
  });

  it("liefert bei Direktstrecken ohne Google-Wert 'unbekannt'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await calculateDirectStartRoutes(
      { label: "Start", lat: 51.2, lon: 6.7 },
      [{ home: "A", away: "B", venueLat: 52.25, venueLon: 7.75, venue: "Beispielstraße 1, 47000 Duisburg" }],
      1,
      { requireGoogle: true },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].distanceKm).toBeNull();
    expect(rows[0].provider).toBeNull();
  });
});
