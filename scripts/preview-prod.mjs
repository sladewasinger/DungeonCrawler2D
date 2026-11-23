/** Serves a frozen production build snapshot of client and server without file watchers. */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveBuildPaths() {
  const serverDistDir = resolve(repoRoot, "packages/game-server/dist");
  const clientDistDir = resolve(repoRoot, "packages/client/dist");
  return {
    serverBundle: resolve(serverDistDir, "main.cjs"),
    serverMap: resolve(serverDistDir, "main.cjs.map"),
    clientDistDir,
    clientIndex: resolve(clientDistDir, "index.html"),
    clientPkgDir: resolve(repoRoot, "packages/client"),
    viteBin: resolve(repoRoot, "node_modules/vite/bin/vite.js"),
  };
}

function assertBuiltArtifacts(paths) {
  if (existsSync(paths.serverBundle) && existsSync(paths.clientIndex)) return;
  console.error("Missing production build artifacts. Run 'npm run build' first.");
  process.exit(1);
}

function createFrozenSnapshot(paths) {
  const rootDir = mkdtempSync(join(tmpdir(), "dc2d-preview-prod-"));
  const clientDir = resolve(rootDir, "client");
  const serverDir = resolve(rootDir, "server");
  const serverEntry = resolve(serverDir, "main.cjs");
  mkdirSync(serverDir, { recursive: true });
  cpSync(paths.clientDistDir, clientDir, { recursive: true });
  cpSync(paths.serverBundle, serverEntry);
  if (existsSync(paths.serverMap)) cpSync(paths.serverMap, resolve(serverDir, "main.cjs.map"));
  return { rootDir, clientDir, serverEntry };
}

function spawnPreviewChildren({ paths, snapshot, clientPort, gamePort }) {
  const serverEnv = { ...process.env, GAME_PORT: gamePort };
  const clientEnv = {
    ...process.env,
    PREVIEW_PORT: clientPort,
    PREVIEW_GAME_PORT: gamePort,
    PREVIEW_OUT_DIR: snapshot.clientDir,
  };
  const serverProc = spawn(process.execPath, [snapshot.serverEntry], {
    stdio: "inherit",
    env: serverEnv,
  });
  const clientProc = spawn(
    process.execPath,
    [paths.viteBin, "preview", "--host", "0.0.0.0", "--port", clientPort],
    { cwd: paths.clientPkgDir, stdio: "inherit", env: clientEnv },
  );
  console.log(
    `[preview-prod] Serving frozen static build (zero watchers): client http://localhost:${clientPort}/ -> server 127.0.0.1:${gamePort}`,
  );
  return [serverProc, clientProc];
}

function cleanupSnapshot(rootDir) {
  try {
    rmSync(rootDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors if child processes are still releasing file handles.
  }
}

function wireShutdown(children, snapshotRoot) {
  let shuttingDown = false;
  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (child.exitCode === null && !child.killed) child.kill();
    }
    cleanupSnapshot(snapshotRoot);
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  for (const child of children) {
    child.on("exit", (code) => shutdown(code ?? 0));
    child.on("error", () => shutdown(1));
  }
}

function main() {
  const paths = resolveBuildPaths();
  assertBuiltArtifacts(paths);
  const snapshot = createFrozenSnapshot(paths);
  const clientPort = process.env.PREVIEW_PORT ?? "4173";
  const gamePort = process.env.PREVIEW_GAME_PORT ?? "4174";
  const children = spawnPreviewChildren({ paths, snapshot, clientPort, gamePort });
  wireShutdown(children, snapshot.rootDir);
}

main();
