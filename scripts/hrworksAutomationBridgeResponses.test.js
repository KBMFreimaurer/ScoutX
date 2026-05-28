// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildHrworksOpenLoginResponse } from "./hrworksAutomationBridgeResponses.js";

describe("hrworksAutomationBridgeResponses", () => {
  it("derives pageCount from the session context instead of a free variable", () => {
    const session = {
      mode: "launched",
      sameBrowser: false,
      attachError: "warning",
      context: {
        pages() {
          return [{}, {}, {}];
        },
      },
    };
    const page = {
      url() {
        return "https://login.hrworks.de/?redirect=/dashboard";
      },
    };

    expect(buildHrworksOpenLoginResponse(session, page)).toEqual({
      ok: true,
      status: "ready",
      browserMode: "launched",
      sameBrowser: false,
      warning: "warning",
      url: "https://login.hrworks.de/?redirect=/dashboard",
      pageCount: 3,
    });
  });
});
