import { describe, expect, it } from "vitest";
import { applyPushAck, filterNotificationsList, markNotificationsRead } from "./teamNotificationsDomainService.js";
import { assertMinLength, assertPasswordMinLength, createTimedToken, normalizeInvitationRole } from "./teamAuthService.js";

describe("team domain services", () => {
  it("filters notifications by status and type", () => {
    const notifications = [
      { id: "n1", type: "plan", unread: true },
      { id: "n2", type: "absage", unread: false },
      { id: "n3", type: "plan", unread: false },
    ];
    expect(filterNotificationsList(notifications, "unread", "")).toHaveLength(1);
    expect(filterNotificationsList(notifications, "read", "plan")).toHaveLength(1);
  });

  it("marks requested notifications as read and counts updates", () => {
    const notifications = [
      { id: "n1", unread: true },
      { id: "n2", unread: false },
      { id: "n3", unread: true },
    ];
    const result = markNotificationsRead(notifications, ["n1", "n2"], (value) => String(value || ""));
    expect(result.updatedCount).toBe(1);
    expect(result.notifications.find((item) => item.id === "n1")?.unread).toBe(false);
    expect(result.notifications.find((item) => item.id === "n3")?.unread).toBe(true);
  });

  it("applies push ack to outbox and acknowledged ids", () => {
    const outbox = new Map([
      ["e1", { eventId: "e1", teamId: "team-a" }],
      ["e2", { eventId: "e2", teamId: "team-b" }],
    ]);
    const acked = new Set();
    const result = applyPushAck(outbox, acked, ["e1", "e2", "e3"], "team-a");
    expect(result.removedCount).toBe(1);
    expect(outbox.has("e1")).toBe(false);
    expect(outbox.has("e2")).toBe(true);
    expect(acked.has("e1")).toBe(true);
    expect(acked.has("e3")).toBe(false);
    expect(acked.has("e2")).toBe(false);
  });

  it("normalizes invitation role and validates auth inputs", () => {
    expect(normalizeInvitationRole("ADMIN")).toBe("admin");
    expect(normalizeInvitationRole("weird-role")).toBe("scout");
    expect(assertMinLength("  abc ", 3, "x")).toBe("abc");
    expect(assertPasswordMinLength("Passwort123", 8)).toBe("Passwort123");
  });

  it("builds timed token payload", () => {
    const fixedNow = Date.UTC(2026, 0, 1, 10, 0, 0);
    const token = createTimedToken(() => "tok-1", 60, fixedNow);
    expect(token.token).toBe("tok-1");
    expect(token.createdAt).toBe(new Date(fixedNow).toISOString());
    expect(token.expiresAt).toBe(new Date(fixedNow + 60000).toISOString());
  });
});
