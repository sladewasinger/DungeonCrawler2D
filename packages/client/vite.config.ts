// Clean Vite configuration for the 2D overworld client.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const clientRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(clientRoot, "../..");
const applicationVersion = JSON.parse(
  readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
).version as string;

function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [
    {
      name: "watch-workspace-packages",
      configureServer(server) {
        server.watcher.add([
          resolve(repositoryRoot, "packages/engine/src"),
          resolve(repositoryRoot, "packages/content/src"),
        ]);
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@dc2d/engine", "@dc2d/content"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [repositoryRoot],
    },
    proxy: {
      "/ws": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(applicationVersion),
    __BUILD_SHA__: JSON.stringify(gitShortSha()),
  },
  build: {
    manifest: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(clientRoot, "index.html"),
        soundStudio: resolve(clientRoot, "sound-studio.html"),
      },
    },
  },
});
