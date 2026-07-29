#!/usr/bin/env node
// Deploy-workflow smoke test: joins the live game-server via its public
// wss endpoint, completes the hello->welcome handshake for the dungeon
// level, sends a few input intents, and asserts snapshots keep arriving.
// Also opens a SECOND socket and confirms a global chat line sent from
// the first actually crosses to it — the same "global reaches everyone
// immediately" contract docs/ROADMAP.md Epic 7.9 promises, checked against
// the real deployed server, not just in-process tests.
// Invoked by the deploy workflow as `node tools/smoke-production.mjs <siteUrl>`.
// Self-contained: only the `ws` package (declared in tools/package.json).

import { readFileSync } from "node:fs";
import {
  joinSocket,
  sendGlobalChat,
  sendInputIntents,
  waitForChatLine,
  waitForSnapshots,
  withTimeout,
} from "./lib/smoke-socket.mjs";

// Read the protocol version straight from the engine source so this script
// can never drift from a bump again (deploy #3 failed exactly that way).
const constantsSrc = readFileSync(
  new URL("../packages/engine/src/core/constants.ts", import.meta.url),
  "utf8",
);
const versionMatch = constantsSrc.match(/PROTOCOL_VERSION = (\d+)/);
if (!versionMatch) throw new Error("smoke: PROTOCOL_VERSION not found in engine constants.ts");
const PROTOCOL_VERSION = Number(versionMatch[1]);
const HANDSHAKE_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 10_000;
const INPUT_INTENTS_TO_SEND = 5;
const INPUT_INTERVAL_MS = 100;
const CHAT_TIMEOUT_MS = 10_000;
const rootManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const APP_VERSION = rootManifest.version;

function fail(message) {
  console.error(`[smoke] FAIL: ${message}`);
  process.exitCode = 1;
}

/** AggregateError (e.g. ECONNREFUSED on dual-stack lookups) has an empty `.message`. */
function describeError(err) {
  if (!(err instanceof Error)) return String(err);
  return err.message || err.code || err.errors?.map((e) => e.message).join("; ") || err.name;
}

function wsUrlFor(siteUrl) {
  const url = new URL(siteUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function assertReleasePage(siteUrl, pathname, marker) {
  const url = new URL(pathname, siteUrl);
  const response = await fetch(url, { redirect: "error" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }
  if (!contentType.includes("text/html")) {
    throw new Error(`${pathname} returned ${contentType || "no content type"}`);
  }
  if (!body.includes(marker) || body.includes('<div id="app"></div>')) {
    throw new Error(`${pathname} returned the game shell instead of release notes`);
  }
}

async function runReleaseNotesChecks(siteUrl) {
  await assertReleasePage(
    siteUrl,
    "/releases/index.html",
    "<h1>Release Notes</h1>",
  );
  await assertReleasePage(
    siteUrl,
    `/releases/v${APP_VERSION}.html`,
    `<h1>v${APP_VERSION} ·`,
  );
  console.log(`[smoke] release index and v${APP_VERSION} page loaded — OK`);
}

/** Original single-socket smoke: handshake, a few input intents, snapshots keep arriving. */
async function runSoloChecks(target) {
  const { ws, welcome } = await joinSocket(target, {
    name: "SmokeSolo", level: "dungeon", protocol: PROTOCOL_VERSION, handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
  });
  try {
    if (welcome.level !== "dungeon") {
      throw new Error(`expected dungeon level, got ${welcome.level}`);
    }
    console.log(`[smoke] joined as ${welcome.playerId} (protocol ${welcome.protocol}, tick ${welcome.tickRate}Hz)`);

    const snapshotsWaiter = waitForSnapshots(ws, 3);
    await sendInputIntents(ws, { count: INPUT_INTENTS_TO_SEND, interval: INPUT_INTERVAL_MS });
    const seen = await withTimeout(snapshotsWaiter, SNAPSHOT_TIMEOUT_MS, "snapshot wait");
    console.log(`[smoke] received ${seen} snapshots after input intents — OK`);
  } finally {
    ws.close();
  }
}

/** Two real sockets: a global chat line sent from one must cross to the other —
 * the deployed-server counterpart to the committed e2e suite's chat.test.ts.
 * Runs in the SANDBOX sim: global chat is scoped per-sim, so real players in
 * the dungeon never see the smoke line (a live player screenshotted one). */
async function runChatCrossCheck(target) {
  const socketOptions = { level: "sandbox", protocol: PROTOCOL_VERSION, handshakeTimeout: HANDSHAKE_TIMEOUT_MS };
  const a = await joinSocket(target, { ...socketOptions, name: "SmokeChatA" });
  const b = await joinSocket(target, { ...socketOptions, name: "SmokeChatB" });
  try {
    const marker = `smoke-global-${Date.now().toString(36)}`;
    const heardWaiter = waitForChatLine(b.ws, marker);
    sendGlobalChat(a.ws, marker);
    await withTimeout(heardWaiter, CHAT_TIMEOUT_MS, "global chat cross-socket wait");
    console.log("[smoke] global chat line crossed sockets — OK");
  } finally {
    a.ws.close();
    b.ws.close();
  }
}

async function main() {
  const siteUrl = process.argv[2];
  if (!siteUrl) {
    fail("usage: node tools/smoke-production.mjs <siteUrl>");
    return;
  }

  const target = wsUrlFor(siteUrl);
  console.log(`[smoke] connecting to ${target}`);

  try {
    await runReleaseNotesChecks(siteUrl);
    await runSoloChecks(target);
    await runChatCrossCheck(target);
  } catch (err) {
    fail(describeError(err));
  }
}

await main();
process.exit(process.exitCode ?? 0);
