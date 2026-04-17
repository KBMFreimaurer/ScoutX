export const SERVICE_WORKER_UPDATE_EVENT = "scoutx:service-worker-update";

function dispatchUpdateEvent(registration) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SERVICE_WORKER_UPDATE_EVENT, {
      detail: { registration },
    }),
  );
}

export function activateServiceWorkerUpdate(registration) {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  const waitingWorker = registration?.waiting;
  if (!waitingWorker) {
    return false;
  }

  let reloaded = false;
  const onControllerChange = () => {
    if (reloaded) {
      return;
    }
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export function registerServiceWorker(options = {}) {
  if (!import.meta.env.PROD) {
    return;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const autoActivate = Boolean(options.autoActivate);

  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          const handleUpdateAvailable = () => {
            dispatchUpdateEvent(registration);
            if (autoActivate) {
              activateServiceWorkerUpdate(registration);
            }
          };

          if (registration.waiting) {
            handleUpdateAvailable();
          }

          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (!installingWorker) {
              return;
            }

            installingWorker.addEventListener("statechange", () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                handleUpdateAvailable();
              }
            });
          });
        })
        .catch((error) => {
          console.error("[ScoutX PWA] Service-Worker Registrierung fehlgeschlagen:", error);
        });
    },
    { once: true },
  );
}
