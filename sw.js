/* Service Worker – Offline-Unterstützung für den Adventskalender */

const CACHE_VERSION = "advent-v10";
const CACHE_NAME = CACHE_VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./manifest.json?v=9",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon-1024.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png?v=9",
  "./icons/icon-512.png?v=9",
  "./icons/icon-512-maskable.png?v=9",
  "./icons/icon-1024.png?v=9",
  "./icons/favicon-32.png?v=9",
  "./apple-touch-icon.png",
  "./apple-touch-icon-v9.png",
  "./apple-touch-icon-v9.png?v=9",
  "./secure/meta.json",
  "./secure/meta.enc",
  "./secure/img/photo.bin",
  "./secure/img/day-01.bin",
  "./secure/img/day-02.bin",
  "./secure/img/day-03.bin",
  "./secure/img/day-04.bin",
  "./secure/img/day-05.bin",
  "./secure/img/day-06.bin",
  "./secure/img/day-07.bin",
  "./secure/img/day-08.bin",
  "./secure/img/day-09.bin",
  "./secure/img/day-10.bin",
  "./secure/img/day-11.bin",
  "./secure/img/day-12.bin",
  "./secure/img/day-13.bin",
  "./secure/img/day-14.bin",
  "./secure/img/day-15.bin",
  "./secure/img/day-16.bin",
  "./secure/img/day-17.bin",
  "./secure/img/day-18.bin",
  "./secure/img/day-19.bin",
  "./secure/img/day-20.bin",
  "./secure/img/day-21.bin",
  "./secure/img/day-22.bin",
  "./secure/img/day-23.bin",
  "./secure/img/day-24.bin"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch(() => null) // fehlende Dateien überspringen
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isFreshFirst(request, url) {
  if (request.mode === "navigate") return true;
  if (url.pathname.indexOf("/secure/") !== -1) return true;
  return /\.(?:html|css|js|json)$/i.test(url.pathname);
}

function cachedFallback(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    const url = new URL(request.url);
    if (url.search && url.pathname.indexOf("/secure/") !== -1) {
      url.search = "";
      return caches.match(url.href).then((plain) => plain || undefined);
    }
    return undefined;
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isFreshFirst(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          cachedFallback(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === "navigate") {
              return caches.match("./index.html");
            }
            return Response.error();
          })
        )
    );
    return;
  }

  event.respondWith(
    cachedFallback(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => Response.error());
    })
  );
});

