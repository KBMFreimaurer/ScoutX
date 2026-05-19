import { STORAGE_RETENTION_RULES } from "../config/storage";

const META_KEY = "scoutx.storageMeta.v1";

function readMeta(storage, rawRead) {
  try {
    const raw = String(rawRead.call(storage, META_KEY) || "").trim();
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeMeta(storage, rawWrite, meta) {
  try {
    rawWrite.call(storage, META_KEY, JSON.stringify(meta || {}));
  } catch {
    // Ignore optional storage write failures.
  }
}

function buildRuleMap(storageName) {
  const map = new Map();
  for (const rule of STORAGE_RETENTION_RULES) {
    if (rule?.storage === storageName && rule?.key) {
      map.set(String(rule.key), rule);
    }
  }
  return map;
}

function applyRetentionForStorage(storage, storageName, nowMs) {
  if (!storage) {
    return;
  }
  const rawGetItem = storage.getItem;
  const rawSetItem = storage.setItem;
  const rawRemoveItem = storage.removeItem;
  if (
    typeof rawGetItem !== "function" ||
    typeof rawSetItem !== "function" ||
    typeof rawRemoveItem !== "function"
  ) {
    return;
  }

  const rules = buildRuleMap(storageName);
  if (rules.size === 0) {
    return;
  }

  const meta = readMeta(storage, rawGetItem);
  let metaChanged = false;

  for (const [key, rule] of rules.entries()) {
    const exists = rawGetItem.call(storage, key) !== null;
    if (!exists) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) {
        delete meta[key];
        metaChanged = true;
      }
      continue;
    }
    const lastTouched = Number(meta[key] || 0);
    if (!Number.isFinite(lastTouched) || lastTouched <= 0) {
      meta[key] = nowMs;
      metaChanged = true;
      continue;
    }
    if (Number.isFinite(rule.ttlMs) && rule.ttlMs > 0 && nowMs - lastTouched > rule.ttlMs) {
      rawRemoveItem.call(storage, key);
      delete meta[key];
      metaChanged = true;
    }
  }

  if (metaChanged) {
    writeMeta(storage, rawSetItem, meta);
  }

  if (storage.__scoutxRetentionPatched) {
    return;
  }

  storage.setItem = function patchedSetItem(key, value) {
    rawSetItem.call(this, key, value);
    const keyStr = String(key || "");
    if (!rules.has(keyStr) || keyStr === META_KEY) {
      return;
    }
    const nextMeta = readMeta(this, rawGetItem);
    nextMeta[keyStr] = Date.now();
    writeMeta(this, rawSetItem, nextMeta);
  };

  storage.removeItem = function patchedRemoveItem(key) {
    rawRemoveItem.call(this, key);
    const keyStr = String(key || "");
    if (!rules.has(keyStr) || keyStr === META_KEY) {
      return;
    }
    const nextMeta = readMeta(this, rawGetItem);
    if (Object.prototype.hasOwnProperty.call(nextMeta, keyStr)) {
      delete nextMeta[keyStr];
      writeMeta(this, rawSetItem, nextMeta);
    }
  };

  if (typeof storage.clear === "function") {
    const rawClear = storage.clear;
    storage.clear = function patchedClear() {
      rawClear.call(this);
      writeMeta(this, rawSetItem, {});
    };
  }

  Object.defineProperty(storage, "__scoutxRetentionPatched", {
    value: true,
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

export function bootstrapStorageRetention(nowMs = Date.now()) {
  if (typeof window === "undefined") {
    return;
  }
  applyRetentionForStorage(window.localStorage, "localStorage", nowMs);
  applyRetentionForStorage(window.sessionStorage, "sessionStorage", nowMs);
}

