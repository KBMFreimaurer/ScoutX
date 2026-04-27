export function registerServiceWorker() {
  if (!import.meta.env.PROD) {
    return;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await registration.update();
      } catch (error) {
        console.error("[ScoutX PWA] Service-Worker Registrierung fehlgeschlagen:", error);
      }
    },
    { once: true },
  );
}
