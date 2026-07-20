// Vite dev/build config for the client: fixed dev-server port, default static build,
// plus a build-time git-SHA stamp for the telemetry stack (src/buildInfo.ts).
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** Short commit hash at build time; "dev" outside a git checkout (e.g. a clean tarball). */
function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  server: { port: 5173 },
  define: { __BUILD_SHA__: JSON.stringify(gitShortSha()) },
  build: {
    rollupOptions: {
      // Second input alongside index.html: the service worker (src/boot/sw/serviceWorkerEntry.ts)
      // needs the same __BUILD_SHA__ define as the app bundle (cache name derivation —
      // src/boot/sw/cacheName.ts), so it's built by this same vite pass rather than a
      // separate script, and pinned to an unhashed "sw.js" at the site root — a browser
      // only ever looks for a service worker at the exact URL it was registered with.
      input: { main: "index.html", sw: "src/boot/sw/serviceWorkerEntry.ts" },
      output: {
        entryFileNames: (chunk) => (chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
