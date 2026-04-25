const CACHE_VERSION = "v2";
const SHELL_CACHE = `scoutx-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `scoutx-runtime-${CACHE_VERSION}`;
const OFFLINE_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/scoutx-icon-192.png",
  "/scoutx-icon.png",
  "/apple-touch-icon.png",
];

function isCacheableSameOrigin(request, url) {
  if (request.method !== "GET") {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ollama/")) {
    return false;
  }

  return true;
}

function isStaticAssetRequest(request, url) {
  if (!isCacheableSameOrigin(request, url)) {
    return false;
  }

  if (url.pathname.startsWith("/assets/")) {
    return true;
  }

  return ["script", "style", "image", "font", "manifest"].includes(request.destination);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(OFFLINE_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith("scoutx-shell-") || key.startsWith("scoutx-runtime-"))
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isCacheableSameOrigin(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const runtime = await caches.open(RUNTIME_CACHE);
            runtime.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedPage = await caches.match(request);
          if (cachedPage) {
            return cachedPage;
          }
          const fallback = await caches.match("/index.html");
          if (fallback) {
            return fallback;
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  if (!isStaticAssetRequest(request, url)) {
    return;
  }

  event.respondWith(
    (async () => {
      const runtime = await caches.open(RUNTIME_CACHE);
      const cached = await runtime.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            runtime.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        return cached;
      }
      const networkResponse = await networkFetch;
      if (networkResponse) {
        return networkResponse;
      }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
