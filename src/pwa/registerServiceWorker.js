export function registerServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith("scoutx-shell-") || key.startsWith("scoutx-runtime-"))
              .map((key) => caches.delete(key)),
          );
        }
      } catch (error) {
        console.error("[ScoutX PWA] Service-Worker Bereinigung fehlgeschlagen:", error);
      }
    },
    { once: true },
  );
}
