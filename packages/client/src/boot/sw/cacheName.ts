// Derives the service worker's Cache Storage key from the build SHA, so every deploy
// gets its own cache namespace — install can never mix bytes from two different builds,
// and activate's cleanup (serviceWorkerEntry.ts) simply deletes every cache whose name
// doesn't match the SHA baked into the currently-running worker.
const CACHE_PREFIX = "dc2d-cache";

/** `sha` is vite's __BUILD_SHA__ define (short git hash, or "dev" outside a checkout). */
export function deriveCacheName(sha: string): string {
  return `${CACHE_PREFIX}-${sha}`;
}

export function isDc2dCacheName(name: string): boolean {
  return name.startsWith(`${CACHE_PREFIX}-`);
}
