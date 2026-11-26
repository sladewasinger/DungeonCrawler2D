/** Zero-dependency dev process supervisor launching @dc2d/game-server and @dc2d/client. */
import { spawn } from "node:child_process";
import process from "node:process";

const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";
const lan = process.argv.includes("--lan");
const viteHost = lan ? "0.0.0.0" : (process.env.VITE_HOST ?? "127.0.0.1");
const serverEnv = {
  ...process.env,
  GAME_HOST: lan ? "0.0.0.0" : (process.env.GAME_HOST ?? "127.0.0.1"),
  ALLOW_OPEN_DEV_ADMIN: lan ? (process.env.ALLOW_OPEN_DEV_ADMIN ?? "0") : (process.env.ALLOW_OPEN_DEV_ADMIN ?? "1"),
};
const clientEnv = { ...process.env, VITE_HOST: viteHost };

const children = [
  spawn(NPM_CMD, ["run", "dev", "-w", "@dc2d/game-server"], { stdio: "inherit", env: serverEnv, shell: process.platform === "win32" }),
  spawn(NPM_CMD, ["run", "dev", "-w", "@dc2d/client"], { stdio: "inherit", env: clientEnv, shell: process.platform === "win32" }),
];

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
for (const child of children) {
  child.on("exit", (code) => shutdown(code ?? 0));
  child.on("error", () => shutdown(1));
}
