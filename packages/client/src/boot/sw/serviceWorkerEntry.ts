/// <reference lib="webworker" />
// Minimal installable service worker: network-first for the navigation/index.html shell
// (a stale shell can point at hashed asset filenames that no longer exist on the CDN),
// cache-first for everything else (vite's hashed build output is immutable — a given
// filename's bytes never change, so once cached it's safe to serve without a round
// trip). The cache name is keyed on __BUILD_SHA__ (vite.config.ts's define, same one
// buildInfo.ts stamps on-screen) so a new deploy never mixes bytes from two builds —
// activate deletes every cache whose name isn't this build's (deriveCacheName below).
// Registered by registerServiceWorker.ts; DOM lib is excluded here on purpose (see
// tsconfig.sw.json) — ServiceWorkerGlobalScope and Window can't coexist in one program.
import { deriveCacheName, isDc2dCacheName } from "./cacheName.js";

export {};
declare const self: ServiceWorkerGlobalScope;
declare const __BUILD_SHA__: string;

const CACHE_NAME = deriveCacheName(__BUILD_SHA__);
const NAVIGATION_FALLBACK = "/index.html";

/** vite's hashed build output (assets/*-<hash>.js|css, atlas.png, etc.) — content-addressed, so cache-first is always correct. */
function isImmutableAsset(url: URL): boolean {
  return url.pathname.startsWith("/assets/") || /\.(png|ttf|json)$/.test(url.pathname);
}

self.addEventListener("install", (event) => {
  // Takes over from any previously-waiting worker immediately — the deploy pipeline
  // must never leave a player stuck on a stale client (brief's hard requirement).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => isDc2dCacheName(name) && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function handleNavigation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(NAVIGATION_FALLBACK, response.clone());
    return response;
  } catch {
    const cached = await caches.match(NAVIGATION_FALLBACK);
    if (cached) return cached;
    throw new Error("navigation fetch failed and no cached shell is available");
  }
}

async function handleImmutableAsset(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
  } else if (isImmutableAsset(url)) {
    event.respondWith(handleImmutableAsset(event.request));
  }
});
