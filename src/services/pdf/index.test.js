import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import {
  applyAuthoritativeGameCorrections,
  buildPdf,
  hasCompleteDirectRoutes,
  hasCompleteRouteOverview,
  openScoutPdf,
  resolvePdfDeliveryMode,
} from "./index";

describe("pdf/index authoritative correction", () => {
  it("überschreibt Uhrzeit und Spielort anhand gleicher Spiel-ID", () => {
    const games = [
      {
        id: "match-1",
        home: "FSV Duisburg",
        away: "Vogelheimer SV",
        dateObj: new Date(2026, 3, 25),
        time: "17:30",
        venue: "Alter Platz",
      },
    ];

    const authoritative = [
      {
        id: "match-1",
        home: "FSV Duisburg",
        away: "Vogelheimer SV",
        dateObj: new Date(2026, 3, 25),
        time: "15:30",
        venue: "Kunstrasenplatz, FSV Duisburg",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:30");
    expect(result.games[0].venue).toBe("Kunstrasenplatz, FSV Duisburg");
  });

  it("matched ohne ID über Teams + Datum und korrigiert Felder", () => {
    const games = [
      {
        home: "SF Hamborn 07",
        away: "TURU 1880 Düsseldorf",
        dateObj: new Date(2026, 3, 25),
        time: "13:00",
        venue: "Sportanlage",
      },
    ];

    const authoritative = [
      {
        home: "SF Hamborn 07",
        away: "TURU 1880 Düsseldorf",
        date: "2026-04-25",
        time: "15:00",
        venue: "BSA Im Holtkamp, Containerbau MiRO Sportarena",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:00");
    expect(result.games[0].venue).toContain("BSA Im Holtkamp");
  });

  it("lässt Spiele unverändert wenn bereits identisch", () => {
    const games = [
      {
        id: "match-2",
        home: "Duisburger FV 08",
        away: "TV Jahn Hiesfeld",
        dateObj: new Date(2026, 3, 25),
        time: "15:15",
        venue: "Paul-Esch-Str. 25, 47053 Duisburg",
      },
    ];

    const authoritative = [
      {
        id: "match-2",
        home: "Duisburger FV 08",
        away: "TV Jahn Hiesfeld",
        date: "2026-04-25",
        time: "15:15",
        venue: "Paul-Esch-Str. 25, 47053 Duisburg",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(0);
    expect(result.games[0]).toBe(games[0]);
  });
});

describe("pdf/index route completeness", () => {
  it("erkennt vollständige Route-Overview", () => {
    const routeOverview = {
      legs: [{}, {}, {}],
    };

    expect(hasCompleteRouteOverview(routeOverview, 2)).toBe(true);
    expect(hasCompleteRouteOverview(routeOverview, 3)).toBe(false);
    expect(hasCompleteRouteOverview(routeOverview, 4)).toBe(false);
  });

  it("erkennt vollständige Direkt-Routen", () => {
    const directRows = [{}, {}, {}];

    expect(hasCompleteDirectRoutes(directRows, 3)).toBe(true);
    expect(hasCompleteDirectRoutes(directRows, 5)).toBe(false);
  });
});

describe("pdf/index delivery mode", () => {
  it("nutzt auf iOS nativ immer den Share-Flow", () => {
    const previousCapacitor = window.Capacitor;
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
    };

    expect(resolvePdfDeliveryMode(null)).toBe("native-share");
    expect(resolvePdfDeliveryMode({ mode: "preview" })).toBe("native-share");

    if (previousCapacitor) {
      window.Capacitor = previousCapacitor;
    } else {
      delete window.Capacitor;
    }
  });

  it("nutzt auf Web den Preview-Flow bei mode=preview", () => {
    const previousCapacitor = window.Capacitor;
    delete window.Capacitor;
    expect(resolvePdfDeliveryMode({ mode: "preview" })).toBe("preview");
    expect(resolvePdfDeliveryMode(null)).toBe("download");
    if (previousCapacitor) {
      window.Capacitor = previousCapacitor;
    }
  });
});

describe("pdf/index page output", () => {
  it("erzeugt bei Fahrtkosten-/Arbeitszeitdaten ein mehrseitiges PDF", () => {
    const games = [
      {
        id: "g1",
        date: "2026-05-10",
        dateObj: new Date("2026-05-10T10:00:00"),
        time: "10:30",
        home: "MSV Duisburg U17",
        away: "RW Essen U17",
        venue: "Sportanlage Duisburg, Platz 1",
        distanceKm: 24.4,
      },
    ];

    const cfg = {
      kreisLabel: "Duisburg",
      jugendLabel: "U17",
      scoutName: "Scout Test",
      kmPauschale: 0.4,
      presenceOverrides: { g1: 180 },
    };

    const doc = buildPdf(jsPDF, games, cfg);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("liefert für iOS-Share und Web-Preview denselben PDF-Inhalt", async () => {
    const previousCapacitor = window.Capacitor;
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL");
    const revokeObjectUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const shareModule = await import("../../native/share");
    const shareSpy = vi.spyOn(shareModule, "shareOrDownloadBlob");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-08T10:30:00.000Z"));

      let iosBlob = null;
      let webBlob = null;
      createObjectUrlSpy.mockImplementation((blob) => {
        webBlob = blob;
        return "blob:test-preview";
      });
      shareSpy.mockImplementation(async (blob) => {
        iosBlob = blob;
        return { ok: true, method: "share", fallbackUsed: false };
      });

      const games = [
        {
          id: "g1",
          date: "2026-05-10",
          dateObj: new Date("2026-05-10T10:00:00"),
          time: "10:30",
          home: "MSV Duisburg U17",
          away: "RW Essen U17",
          venue: "Sportanlage Duisburg, Platz 1",
          distanceKm: 24.4,
        },
      ];
      const cfg = {
        kreisLabel: "Duisburg",
        jugendLabel: "U17",
        scoutName: "Scout Test",
        kmPauschale: 0.4,
        presenceOverrides: { g1: 180 },
      };

      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => "ios",
      };
      const iosResult = await openScoutPdf(games, "", cfg, null, null, null);
      expect(iosResult?.ok).toBe(true);
      expect(iosBlob).toBeInstanceOf(Blob);

      delete window.Capacitor;
      const webResult = await openScoutPdf(games, "", cfg, null, null, { mode: "preview" });
      expect(webResult?.ok).toBe(true);
      expect(webBlob).toBeInstanceOf(Blob);

      const toBytes = async (blobLike) => {
        if (blobLike && typeof blobLike.arrayBuffer === "function") {
          return new Uint8Array(await blobLike.arrayBuffer());
        }
        return new Uint8Array(await new Response(blobLike).arrayBuffer());
      };
      const iosBytes = await toBytes(iosBlob);
      const webBytes = await toBytes(webBlob);
      expect(webResult?.previewUrl).toBe("blob:test-preview");
      expect(iosBytes.length).toBeGreaterThan(0);
      expect(webBytes.length).toBeGreaterThan(0);
      expect(iosBytes).toEqual(webBytes);

      webResult?.revoke?.();
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:test-preview");
    } finally {
      if (previousCapacitor) {
        window.Capacitor = previousCapacitor;
      } else {
        delete window.Capacitor;
      }
      vi.useRealTimers();
      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
      shareSpy.mockRestore();
    }
  });
});
