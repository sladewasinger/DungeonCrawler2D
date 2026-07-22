// Vite dev/build config for the client: fixed dev-server port, default static build,
// plus a build-time git-SHA stamp for the telemetry stack (src/buildInfo.ts).
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const clientRoot = dirname(fileURLToPath(import.meta.url));
const threeModelDirectory = resolve(clientRoot, "../../assets/3D/models/Fantasy_Heroes_Free");
const threeAssets = new Map([
  ["Knight_Animated.fbx", resolve(threeModelDirectory, "FBX/Characters/Knight_Animated.fbx")],
  ["Texture.png", resolve(threeModelDirectory, "Texture/Texture.png")],
]);

/** Short commit hash at build time; "dev" outside a git checkout (e.g. a clean tarball). */
function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

function assetName(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return new URL(url, "http://three-assets.local").pathname.split("/").pop();
}

function copyThreeAssets(outputDirectory: string): void {
  const destination = resolve(outputDirectory, "assets/three-models");
  mkdirSync(destination, { recursive: true });
  for (const [name, source] of threeAssets) copyFileSync(source, resolve(destination, name));
}

function serveThreeAssets() {
  return {
    name: "serve-three-assets",
    configureServer(server: { middlewares: { use(path: string, handler: (request: { url?: string }, response: { end(value: Buffer): void; setHeader(name: string, value: string): void }, next: () => void) => void): void } }): void {
      server.middlewares.use("/assets/three-models", (request, response, next) => {
        const source = threeAssets.get(assetName(request.url) ?? "");
        if (!source) return next();
        response.setHeader("Content-Type", source.endsWith(".png") ? "image/png" : "application/octet-stream");
        response.end(readFileSync(source));
      });
    },
    closeBundle(): void {
      copyThreeAssets(resolve(clientRoot, "dist"));
    },
  };
}

export default defineConfig({
  server: { port: 5173 },
  define: { __BUILD_SHA__: JSON.stringify(gitShortSha()) },
  plugins: [serveThreeAssets()],
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
