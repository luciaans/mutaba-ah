const CACHE_NAME = "mutabaah-static-v2";
const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(self.location.hostname);
const STATIC_FILES = [
  "/offline.html",
  "/masjid-mark.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("mutabaah-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Next.js dev chunks are frequently rebuilt with the same paths. Never serve
  // a previously cached chunk on localhost, or the UI can lag behind the source.
  if (isLocalDevelopment && url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/_next/static/") || STATIC_FILES.includes(url.pathname);
  if (isStaticAsset) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()));
  }
});
