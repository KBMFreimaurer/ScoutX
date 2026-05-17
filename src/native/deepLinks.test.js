import { describe, expect, it } from "vitest";
import { resolveScoutxDeepLink } from "./deepLinks";

describe("resolveScoutxDeepLink", () => {
  it("resolves direct destination hosts used by iOS intents", () => {
    expect(resolveScoutxDeepLink("scoutx://setup")).toBe("/setup");
    expect(resolveScoutxDeepLink("scoutx://games")).toBe("/games");
    expect(resolveScoutxDeepLink("scoutx://plan")).toBe("/plan");
    expect(resolveScoutxDeepLink("scoutx://scout-sheet")).toBe("/scout-sheet");
    expect(resolveScoutxDeepLink("scoutx://dashboard")).toBe("/dashboard");
    expect(resolveScoutxDeepLink("scoutx://hub")).toBe("/hub");
  });

  it("supports query-based deep link routing", () => {
    expect(resolveScoutxDeepLink("scoutx://open?to=games")).toBe("/games");
    expect(resolveScoutxDeepLink("scoutx://open?path=scout-sheet")).toBe("/scout-sheet");
  });

  it("returns null for non-scoutx URLs", () => {
    expect(resolveScoutxDeepLink("https://example.com")).toBe(null);
    expect(resolveScoutxDeepLink("")).toBe(null);
    expect(resolveScoutxDeepLink("not-a-url")).toBe(null);
  });
});
