/// <reference lib="webworker" />
// Minimal installable service worker: network-first for the navigation/index.html shell
// (a stale shell can point at hashed asset filenames that no longer exist on the CDN),
// cache-first for build-versioned public assets and Vite's hashed output. Fixed-name
// public assets are mutable and must never be mixed across builds. The cache name is
// keyed on __BUILD_SHA__ (vite.config.ts's define, same one
// buildInfo.ts stamps on-screen) so a new deploy never mixes bytes from two builds —
// activate deletes every cache whose name isn't this build's (deriveCacheName below).
// Registered by registerServiceWorker.ts; DOM lib is excluded here on purpose (see
// tsconfig.sw.json) — ServiceWorkerGlobalScope and Window can't coexist in one program.
import { deriveCacheName, isDc2dCacheName } from "./cacheName.js";
import {
  isCacheableResponse,
  isCacheableImmutableAssetResponse,
  isGameShellNavigation,
  isImmutableAssetRequest,
} from "./assetCaching.js";

export {};
declare const self: ServiceWorkerGlobalScope;
declare const __BUILD_SHA__: string;

const CACHE_NAME = deriveCacheName(__BUILD_SHA__);
const NAVIGATION_FALLBACK = "/index.html";

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

async function cacheResponse(
  request: Request | string,
  response: Response,
): Promise<void> {
  if (!isCacheableResponse(response)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache failures must not turn a valid network response into a game error.
  }
}

async function handleNavigation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (isGameShellNavigation(request, self.location.origin)) {
      await cacheResponse(NAVIGATION_FALLBACK, response);
    }
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
  if (isCacheableImmutableAssetResponse(request, response)) {
    await cacheResponse(request, response);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
  } else if (isImmutableAssetRequest(event.request, self.location.origin)) {
    event.respondWith(handleImmutableAsset(event.request));
  }
});
