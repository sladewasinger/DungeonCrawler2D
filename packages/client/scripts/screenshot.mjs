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
    if (await serverResponded(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`vite did not become ready within ${timeoutMs}ms`);
}

async function serverResponded(url) {
  try {
    const response = await fetch(url);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function screenshot(args) {
  const url = `http://localhost:${args.port}${args.path}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Number(args.width), height: Number(args.height) },
  });
  const consoleErrors = collectConsoleErrors(page);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(Number(args.waitMs));
  await page.screenshot({ path: args.out });
  await browser.close();
  reportConsoleErrors(consoleErrors);
  console.log(`screenshot written to ${args.out}`);
}

function collectConsoleErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => recordConsoleError(errors, message));
  return errors;
}

function recordConsoleError(errors, message) {
  if (message.type() === "error") errors.push(message.text());
}

function reportConsoleErrors(errors) {
  if (errors.length > 0) console.error("console errors during screenshot:\n" + errors.join("\n"));
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
