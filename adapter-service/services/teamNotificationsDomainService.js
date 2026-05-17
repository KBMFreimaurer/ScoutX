export function filterNotificationsList(notifications, statusFilter, typeFilter) {
  const status = String(statusFilter || "").trim().toLowerCase();
  const type = String(typeFilter || "").trim().toLowerCase();
  const all = Array.isArray(notifications) ? notifications : [];
  return all.filter((item) => {
    const unread = item?.unread !== false;
    if (status === "unread" && !unread) {
      return false;
    }
    if (status === "read" && unread) {
      return false;
    }
    if (type && String(item?.type || "").trim().toLowerCase() !== type) {
      return false;
    }
    return true;
  });
}

export function markNotificationsRead(notifications, ids, normalizeEventId) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  const all = Array.isArray(notifications) ? notifications : [];
  let updatedCount = 0;
  const nextNotifications = all.map((item) => {
    const eventId = normalizeEventId(item?.eventId || item?.id);
    if (!idSet.has(eventId)) {
      return item;
    }
    if (item?.unread !== false) {
      updatedCount += 1;
    }
    return {
      ...item,
      unread: false,
    };
  });
  return { notifications: nextNotifications, updatedCount };
}

export function applyPushAck(teamPushOutbox, pushedCriticalEventIds, ids) {
  let removedCount = 0;
  for (const id of Array.isArray(ids) ? ids : []) {
    if (teamPushOutbox.delete(id)) {
      removedCount += 1;
    }
    pushedCriticalEventIds.add(id);
  }
  return { removedCount };
}
