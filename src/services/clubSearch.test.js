import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClubSuggestions, resolveClubSearchUrl } from "./clubSearch";

describe("clubSearch resolver", () => {
  it("builds relative club search URL from /api/games", () => {
    expect(resolveClubSearchUrl("/api/games")).toBe("/api/clubs/search");
  });

  it("builds absolute club search URL from absolute adapter endpoint", () => {
    expect(resolveClubSearchUrl("http://127.0.0.1:8787/api/games")).toBe("http://127.0.0.1:8787/api/clubs/search");
  });

  it("strips query/hash from absolute endpoint", () => {
    expect(resolveClubSearchUrl("https://example.test/api/games?x=1#anchor")).toBe("https://example.test/api/clubs/search");
  });

  it("falls back to default path for invalid endpoint", () => {
    expect(resolveClubSearchUrl("not-a-url")).toBe("/api/clubs/search");
  });
});

describe("fetchClubSuggestions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normalized unique suggestions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        clubs: [
          { name: "MSV Duisburg", logoUrl: "//www.fussball.de/export.media/msv.png", location: "47055 Duisburg" },
          { name: "MSV Duisburg", logoUrl: "//www.fussball.de/export.media/msv2.png", location: "Dupe" },
          { name: "Duisburger FV 08", logoUrl: "https://www.fussball.de/export.media/dfv.png" },
        ],
      }),
    });

    const result = await fetchClubSuggestions("/api/games", "", "duisburg", 10);
    expect(result).toEqual([
      {
        name: "MSV Duisburg",
        logoUrl: "https://www.fussball.de/export.media/msv.png",
        location: "47055 Duisburg",
        link: "",
      },
      {
        name: "Duisburger FV 08",
        logoUrl: "https://www.fussball.de/export.media/dfv.png",
        location: "",
        link: "",
      },
    ]);
  });

  it("returns [] when query is too short", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await fetchClubSuggestions("/api/games", "", "d");
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns [] on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await fetchClubSuggestions("/api/games", "", "duisburg");
    expect(result).toEqual([]);
  });
});
