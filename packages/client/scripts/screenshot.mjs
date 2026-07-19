#!/usr/bin/env node
// Reusable headless screenshot tool: boots vite on a given port, screenshots a URL, exits.
// Usage: node scripts/screenshot.mjs --port 5181 --path /?scene=gallery --out out.png [--wait-ms 1500]
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const clientDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const out = { port: "5180", path: "/", out: "screenshot.png", waitMs: "1500", width: "1280", height: "720" };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) out[toCamel(key)] = argv[i + 1];
  }
  return out;
}

function toCamel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Starts `vite --port <port>` in the client package and resolves once it accepts
 * connections. Invokes vite's JS entry directly via `node` (not the .cmd/.sh
 * shim) so the child process tree stays killable cross-platform.
 */
async function startVite(port) {
  const viteJs = path.join(clientDir, "..", "..", "node_modules", "vite", "bin", "vite.js");
  const proc = spawn(process.execPath, [viteJs, "--port", port, "--strictPort"], {
    cwd: clientDir,
    stdio: "pipe",
  });
  await waitForServer(`http://localhost:${port}/`, proc);
  return proc;
}

/** Polls the dev server until it responds or the process exits/errors out. */
async function waitForServer(url, proc, timeoutMs = 20000) {
  const start = Date.now();
  let exited = false;
  proc.once("exit", () => {
    exited = true;
  });
  while (Date.now() - start < timeoutMs) {
    if (exited) throw new Error("vite exited before becoming ready");
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`vite did not become ready within ${timeoutMs}ms`);
}

async function screenshot(args) {
  const url = `http://localhost:${args.port}${args.path}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Number(args.width), height: Number(args.height) },
  });
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(Number(args.waitMs));
  await page.screenshot({ path: args.out });
  await browser.close();
  if (consoleErrors.length > 0) {
    console.error("console errors during screenshot:\n" + consoleErrors.join("\n"));
  }
  console.log(`screenshot written to ${args.out}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const viteProc = await startVite(args.port);
  try {
    await screenshot(args);
  } finally {
    viteProc.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
