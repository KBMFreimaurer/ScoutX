import { describe, expect, it } from "vitest";
import { resolveTeamApiBase } from "./teamBackendClient";

describe("teamBackendClient", () => {
  it("uses the web proxy team path by default", () => {
    expect(resolveTeamApiBase("", "/api/games")).toBe("/api/team");
  });

  it("derives the team API from a native adapter endpoint", () => {
    expect(resolveTeamApiBase("", "http://10.0.0.1:8787/api/games")).toBe("http://10.0.0.1:8787/api/team");
  });

  it("honors an explicit team API base override", () => {
    expect(resolveTeamApiBase("http://10.0.0.1:8787/api/team", "/api/games")).toBe("http://10.0.0.1:8787/api/team");
  });
});
