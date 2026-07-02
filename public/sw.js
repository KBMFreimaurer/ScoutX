self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("scoutx-shell-") || key.startsWith("scoutx-runtime-"))
            .map((key) => caches.delete(key)),
        );
      }
      await self.registration.unregister();
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })(),
  );
});
