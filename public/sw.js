/* JFT STORES — MARKETPLACE — service worker
 * Implements:
 *  ✓ Push notification receiving
 *  ✓ Notification click handling
 *  ✓ Offline fallback (/offline.html)
 *  ✓ Static asset caching (CacheFirst for hashed assets, NetworkFirst for HTML)
 *  ✓ Background sync queue (cart-sync tag)
 *  ✓ VAPID authentication (handled by browser via subscription)
 *  ✓ Subscription management (push_subscriptions table + pushsubscriptionchange)
 */
const CACHE = "jfs-v1";
const OFFLINE = "/offline.html";
const PRECACHE = ["/", OFFLINE, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Skip API and auth routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn/")) return;

  // HTML navigations: NetworkFirst with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE).then((r) => r || new Response("offline", { status: 503 })))
    );
    return;
  }

  // Hashed assets: CacheFirst
  if (/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached))
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "JFT STORES — MARKETPLACE", body: "You have a new update.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  const { title, body, url, icon, badge, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag: tag || "jfs",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((arr) => {
      for (const c of arr) {
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Best-effort: clients re-subscribe on next page load via subscribeToPush()
  event.waitUntil(self.registration.pushManager.getSubscription());
});

self.addEventListener("sync", (event) => {
  if (event.tag === "cart-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "cart-sync" }));
      })
    );
  }
});
