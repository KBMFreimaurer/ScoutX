import { describe, expect, it } from "vitest";
import { GERMANY_STATES, getRegionById, getRegionsByState } from "./germany_regions";

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
    });
  });
});
