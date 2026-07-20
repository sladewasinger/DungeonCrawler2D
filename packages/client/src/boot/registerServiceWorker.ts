// Registers the built service worker (sw.js at the site root — see vite.config.ts's
// second rollup input) so the PWA is installable. Production builds only: registering
// against vite's dev server would let the SW intercept and cache dev-only module
// requests, breaking HMR for every other lane working on this package.
export function registerServiceWorker(isProd: boolean): void {
  if (!isProd || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((reason: unknown) => {
      console.warn("[sw] registration failed", reason);
    });
  });
}
