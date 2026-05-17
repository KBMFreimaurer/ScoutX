import { describe, expect, it } from "vitest";
import { normalizeNotificationTargetId } from "./useTeamObservationActions";

describe("useTeamObservationActions helpers", () => {
  it("normalizes notification ids for backend read-ack", () => {
    expect(normalizeNotificationTargetId("notif-abc")).toBe("abc");
    expect(normalizeNotificationTargetId("  notif-xyz  ")).toBe("xyz");
    expect(normalizeNotificationTargetId("plain-id")).toBe("plain-id");
    expect(normalizeNotificationTargetId("")).toBe("");
  });
});
