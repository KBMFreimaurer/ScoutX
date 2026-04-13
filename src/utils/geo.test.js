import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateDirectStartRoutes,
  calculateRoute,
  calculateRouteWithDriving,
  clearRuntimeGoogleMapsApiKey,
  fetchDrivingRoute,
  geocodeAddress,
  getKreisCenter,
  getGoogleRoutingConfig,
  haversineDistance,
  setRuntimeGoogleMapsApiKey,
} from "./geo";

describe("geo utils", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRuntimeGoogleMapsApiKey();
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
          dateObj: new Date("2026-04-18T00:00:00"),
          venueLat: 51.25,
          venueLon: 6.75,
          fromStartRouteDistanceKm: 25.3,
          fromStartRouteMinutes: 34,
        },
        { home: "C", away: "D", dateObj: new Date("2026-04-18T00:00:00"), venueLat: 51.3, venueLon: 6.8 },
      ],
    );

    expect(route.legs).toHaveLength(3);
    expect(route.legs[0].distanceKm).toBe(25.3);
    expect(route.legs[0].durationMinutes).toBe(34);
    expect(route.legs[0].source).toBe("route");
    expect(route.legs[2].to).toBe("Start");
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
        { home: "A", away: "B", dateObj: new Date("2026-04-18T00:00:00"), time: "11:30", venueLat: 51.25, venueLon: 6.75 },
        { home: "C", away: "D", dateObj: new Date("2026-04-18T00:00:00"), time: "15:30", venueLat: 51.3, venueLon: 6.8 },
      ],
    );

    expect(route.legs).toHaveLength(3);
    expect(route.legs[0].source).toBe("route");
    expect(route.legs[1].source).toBe("route");
    expect(route.legs[2].to).toBe("Start");
    expect(route.totalKm).toBeCloseTo(30, 4);
    expect(route.estimatedMinutes).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("startet bei Datumswechsel erneut vom Startort", async () => {
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
        { home: "A", away: "B", dateObj: new Date("2026-04-17T00:00:00"), time: "18:30", venueLat: 51.25, venueLon: 6.75 },
        { home: "C", away: "D", dateObj: new Date("2026-04-18T00:00:00"), time: "11:30", venueLat: 51.3, venueLon: 6.8 },
        { home: "E", away: "F", dateObj: new Date("2026-04-18T00:00:00"), time: "15:30", venueLat: 51.35, venueLon: 6.85 },
      ],
    );

    expect(route.legs).toHaveLength(5);
    expect(route.legs[0].from).toBe("Start");
    expect(route.legs[1].to).toBe("Start");
    expect(route.legs[2].from).toBe("Start");
    expect(route.legs[3].from).toContain("C vs D");
    expect(route.legs[4].to).toBe("Start");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
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

  it("nutzt Google Routes API v2 mit Runtime-Key", async () => {
    setRuntimeGoogleMapsApiKey("AIza-test-runtime-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 15432,
            duration: "1045s",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const route = await fetchDrivingRoute(
      { lat: 51.40101, lon: 6.90101 },
      { lat: 51.51101, lon: 7.01101 },
      { requireGoogle: true },
    );

    expect(route?.distanceKm).toBeCloseTo(15.432, 3);
    expect(route?.durationMinutes).toBe(17);
    expect(route?.provider).toBe("google-routes");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("routes.googleapis.com/directions/v2:computeRoutes");
  });

  it("gibt im Strict-Mode den Google-Geocoding-Fehler weiter", async () => {
    setRuntimeGoogleMapsApiKey("AIza-test-runtime-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message: "API project is not authorized to use this API.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(geocodeAddress("Geibelstraße 1, 47057 Duisburg")).rejects.toThrow(/REQUEST_DENIED/i);
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

  it("liefert den Google-Routing-Konfigstatus", () => {
    const config = getGoogleRoutingConfig();

    expect(config).toMatchObject({
      keyEnvVar: "VITE_GOOGLE_MAPS_API_KEY",
      routeProvider: expect.any(String),
      geocodeProvider: expect.any(String),
      googleConfigured: expect.any(Boolean),
      strictRequested: expect.any(Boolean),
      strictActive: expect.any(Boolean),
    });
  });

  it("nutzt lokal gespeicherten API-Key als Runtime-Quelle", () => {
    const saved = setRuntimeGoogleMapsApiKey("AIza-test-runtime-key");
    expect(saved).toBe(true);

    const config = getGoogleRoutingConfig();
    expect(config.googleConfigured).toBe(true);
    expect(config.keySource).toBe("runtime");
  });

  it("liefert Kreis-Zentren für bekannte Kreis-IDs", () => {
    expect(getKreisCenter("duisburg")).toEqual({ lat: 51.4344, lon: 6.7623 });
    expect(getKreisCenter("unbekannt")).toBeNull();
  });
});
