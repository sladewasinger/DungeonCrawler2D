// Clean Vite configuration for the 2D overworld client.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const clientRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(clientRoot, "../..");
const TUNING_PATH = resolve(clientRoot, "src/render/poseTuning/playerPoseTuning.json");
const applicationVersion = JSON.parse(
  readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
).version as string;

const DEV_HOST = "0.0.0.0";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function commitTuningBody(raw: string, res: ServerResponse): void {
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; female?: unknown; male?: unknown };
    if (parsed.version !== 1 || !parsed.female || !parsed.male) {
      sendJson(res, 400, { ok: false, error: "Invalid tuning schema" });
      return;
    }
    writeFileSync(TUNING_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    sendJson(res, 200, { ok: true, path: "packages/client/src/render/poseTuning/playerPoseTuning.json" });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" });
  }
}

function handleSavePoseTuning(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "POST") { sendJson(res, 405, { ok: false, error: "Method not allowed" }); return; }
  let raw = "";
  let tooLarge = false;
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    if (raw.length + chunk.length > 524_288) { tooLarge = true; return; }
    raw += chunk;
  });
  req.on("end", () => {
    if (tooLarge) { sendJson(res, 413, { ok: false, error: "Payload too large" }); return; }
    commitTuningBody(raw, res);
  });
}

function createWsProxy(port: string) {
  return {
    "/ws": {
      target: `http://127.0.0.1:${port}`,
      ws: true,
      changeOrigin: true,
    },
  };
}

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
        server.middlewares.use("/__dev/save-pose-tuning", handleSavePoseTuning);
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@dc2d/engine", "@dc2d/content"],
  },
  server: {
    host: DEV_HOST,
    port: 5173,
    fs: {
      allow: [repositoryRoot],
    },
    proxy: createWsProxy("4000"),
  },
  preview: {
    host: DEV_HOST,
    port: Number(process.env.PREVIEW_PORT ?? 4173),
    proxy: createWsProxy(process.env.PREVIEW_GAME_PORT ?? "4174"),
  },
  define: {
    __APP_VERSION__: JSON.stringify(applicationVersion),
    __BUILD_SHA__: JSON.stringify(gitShortSha()),
  },
  build: {
    outDir: process.env.PREVIEW_OUT_DIR || "dist",
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
