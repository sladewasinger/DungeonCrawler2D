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
import { WebSocket } from "ws";

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

/** Race a promise against a timeout, rejecting with `label` on expiry. */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Sends the hello handshake for `name`, resolving with the server's welcome. */
function waitForWelcome(ws, name) {
  return new Promise((resolve, reject) => {
    ws.once("open", () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          protocol: PROTOCOL_VERSION,
          name,
          clientId: `smoke-${name}-${Date.now().toString(36)}`,
          level: "dungeon",
        }),
      );
    });
    ws.once("error", reject);
    const onMessage = (raw) => {
      const msg = safeParse(raw);
      if (msg?.type === "error") {
        ws.off("message", onMessage);
        reject(new Error(`server rejected hello: ${msg.code} ${msg.message}`));
        return;
      }
      if (msg?.type === "welcome") {
        ws.off("message", onMessage);
        resolve(msg);
      }
    };
    ws.on("message", onMessage);
  });
}

/** Opens a fresh socket and completes its join handshake; resolves with both. */
async function joinSocket(target, name) {
  const ws = new WebSocket(target);
  const welcome = await withTimeout(waitForWelcome(ws, name), HANDSHAKE_TIMEOUT_MS, `${name} handshake`);
  return { ws, welcome };
}

/** Resolves with the first "snapshot" message for which `predicate` is true — the
 * shared shape both waitForSnapshots and waitForChatLine below are built from. */
function waitForSnapshotWhere(ws, predicate) {
  return new Promise((resolve, reject) => {
    ws.once("error", reject);
    const onMessage = (raw) => {
      const msg = safeParse(raw);
      if (msg?.type !== "snapshot" || !predicate(msg)) return;
      ws.off("message", onMessage);
      resolve(msg);
    };
    ws.on("message", onMessage);
  });
}

function waitForSnapshots(ws, count) {
  let seen = 0;
  return waitForSnapshotWhere(ws, () => ++seen >= count).then(() => seen);
}

/** Resolves once a snapshot's events carry a global chat line with this exact text —
 * proof the message actually crossed sockets, not just that it was accepted. */
function waitForChatLine(ws, text) {
  return waitForSnapshotWhere(ws, (msg) =>
    msg.events?.some((e) => e.t === "chat" && e.channel === "global" && e.text === text),
  );
}

function sendGlobalChat(ws, text) {
  ws.send(JSON.stringify({ type: "chat", channel: "global", text }));
}

function safeParse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

async function sendInputIntents(ws) {
  for (let seq = 1; seq <= INPUT_INTENTS_TO_SEND; seq++) {
    ws.send(JSON.stringify({ type: "input", seq, moveX: 1, moveY: 0, jump: seq % 2 === 0 }));
    await new Promise((resolve) => setTimeout(resolve, INPUT_INTERVAL_MS));
  }
}

/** Original single-socket smoke: handshake, a few input intents, snapshots keep arriving. */
async function runSoloChecks(target) {
  const { ws, welcome } = await joinSocket(target, "SmokeSolo");
  try {
    if (welcome.level !== "dungeon") {
      throw new Error(`expected dungeon level, got ${welcome.level}`);
    }
    console.log(`[smoke] joined as ${welcome.playerId} (protocol ${welcome.protocol}, tick ${welcome.tickRate}Hz)`);

    const snapshotsWaiter = waitForSnapshots(ws, 3);
    await sendInputIntents(ws);
    const seen = await withTimeout(snapshotsWaiter, SNAPSHOT_TIMEOUT_MS, "snapshot wait");
    console.log(`[smoke] received ${seen} snapshots after input intents — OK`);
  } finally {
    ws.close();
  }
}

/** Two real sockets: a global chat line sent from one must cross to the other —
 * the deployed-server counterpart to the committed e2e suite's chat.test.ts. */
async function runChatCrossCheck(target) {
  const a = await joinSocket(target, "SmokeChatA");
  const b = await joinSocket(target, "SmokeChatB");
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
    await runSoloChecks(target);
    await runChatCrossCheck(target);
  } catch (err) {
    fail(describeError(err));
  }
}

await main();
process.exit(process.exitCode ?? 0);
