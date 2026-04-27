import { describe, expect, it } from "vitest";
import { GERMANY_STATES, GERMANY_VERBANDS, getRegionById, getRegionsByState } from "./germany_regions";

describe("germany region data", () => {
  it("enthält alle 16 Bundesländer mit mindestens einer Region", () => {
    expect(GERMANY_STATES).toHaveLength(16);
    expect(GERMANY_STATES.every((state) => state.name && state.code && state.regions.length > 0)).toBe(true);
  });

  it("füllt die Pflichtfelder jeder Region", () => {
    for (const state of GERMANY_STATES) {
      for (const region of state.regions) {
        expect(region.name).toBeTruthy();
        expect(region.displayName).toBeTruthy();
        expect(region.shortCode).toBeTruthy();
        expect(region.stateCode).toBe(state.code);
        expect(region.fussballDeMapping?.searchName).toBeTruthy();
      }
    }
  });

  it("hat keine doppelten shortCodes innerhalb eines Bundeslands", () => {
    for (const state of GERMANY_STATES) {
      const shortCodes = state.regions.map((region) => region.shortCode);
      expect(new Set(shortCodes).size).toBe(shortCodes.length);
    }
  });

  it("behält die bisherigen NRW-Kreise kompatibel bei", () => {
    expect(getRegionsByState("NW").map((region) => region.id)).toEqual([
      "duesseldorf",
      "duisburg",
      "essen",
      "krefeld",
      "moenchen",
      "neuss",
      "oberhausen",
      "viersen",
      "wesel",
      "kleve",
    ]);
    expect(getRegionById("duisburg")?.fussballDeMapping).toMatchObject({
      searchName: "Duisburg",
      verband: "FVN",
      kreis: "Duisburg",
      mandant: "22",
    });
  });

  it("liefert für jede Region einen Verband mit Mandant-Code", () => {
    for (const state of GERMANY_STATES) {
      for (const region of state.regions) {
        expect(region.fussballDeMapping?.verband, `region ${region.id}`).toBeTruthy();
        expect(region.fussballDeMapping?.mandant, `region ${region.id}`).toMatch(/^\d{2}$/);
        expect(region.fussballDeMapping?.areaKeywords?.length, `region ${region.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("baut bayerische Region München mit BFV-Mandant 21", () => {
    const region = getRegionsByState("BY").find((entry) => entry.id === "by-m");
    expect(region?.fussballDeMapping).toMatchObject({
      searchName: "München",
      verband: "BFV",
      mandant: "21",
    });
    expect(region?.fussballDeMapping.areaKeywords).toEqual(expect.arrayContaining(["munchen", "muenchen"]));
  });

  it("erlaubt Verbands-Fallback für Stadtstaat-Auswahl Berlin, aber nicht für Bezirke", () => {
    const berlinAll = getRegionsByState("BE").find((region) => region.shortCode === "B");
    expect(berlinAll?.fussballDeMapping.allowRegionalFallback).toBe(true);
    const tempelhof = getRegionsByState("BE").find((region) => region.shortCode === "B-TS");
    expect(tempelhof?.fussballDeMapping.allowRegionalFallback).toBe(false);
  });

  it("setzt für RP-Region Koblenz den FVR-Verband", () => {
    const koblenz = getRegionsByState("RP").find((region) => region.shortCode === "KO");
    expect(koblenz?.fussballDeMapping).toMatchObject({
      verband: "FVR",
      mandant: "25",
    });
  });

  it("exportiert den globalen Verbandskatalog", () => {
    expect(GERMANY_VERBANDS.FVN).toMatchObject({ code: "FVN", mandant: "22" });
    expect(GERMANY_VERBANDS.BFV_BY).toMatchObject({ code: "BFV", mandant: "21" });
  });
});
