import "@testing-library/jest-dom/vitest";

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

function ensureStorage(name) {
  const candidate = window[name];
  const hasApi =
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function";

  if (!hasApi) {
    Object.defineProperty(window, name, {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}

if (typeof window !== "undefined") {
  ensureStorage("localStorage");
  ensureStorage("sessionStorage");
}
