#!/usr/bin/env node
// Deploy-workflow smoke test: joins the live game-server via its public
// wss endpoint, completes the hello->welcome handshake for the dungeon
// level, sends a few input intents, and asserts snapshots keep arriving.
// Invoked by the deploy workflow as `node tools/smoke-production.mjs <siteUrl>`.
// Self-contained: only the `ws` package (declared in tools/package.json).

import { WebSocket } from "ws";

const PROTOCOL_VERSION = 10;
const HANDSHAKE_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 10_000;
const INPUT_INTENTS_TO_SEND = 5;
const INPUT_INTERVAL_MS = 100;

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

function waitForWelcome(ws) {
  return new Promise((resolve, reject) => {
    ws.once("open", () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          protocol: PROTOCOL_VERSION,
          name: "SmokeTest",
          clientId: `smoke-${Date.now().toString(36)}`,
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

function waitForSnapshots(ws, count) {
  return new Promise((resolve, reject) => {
    let seen = 0;
    ws.once("error", reject);
    const onMessage = (raw) => {
      const msg = safeParse(raw);
      if (msg?.type !== "snapshot") return;
      seen++;
      if (seen >= count) {
        ws.off("message", onMessage);
        resolve(seen);
      }
    };
    ws.on("message", onMessage);
  });
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

async function main() {
  const siteUrl = process.argv[2];
  if (!siteUrl) {
    fail("usage: node tools/smoke-production.mjs <siteUrl>");
    return;
  }

  const target = wsUrlFor(siteUrl);
  console.log(`[smoke] connecting to ${target}`);
  const ws = new WebSocket(target);

  try {
    const welcome = await withTimeout(waitForWelcome(ws), HANDSHAKE_TIMEOUT_MS, "handshake");
    if (welcome.level !== "dungeon") {
      throw new Error(`expected dungeon level, got ${welcome.level}`);
    }
    console.log(`[smoke] joined as ${welcome.playerId} (protocol ${welcome.protocol}, tick ${welcome.tickRate}Hz)`);

    const snapshotsWaiter = waitForSnapshots(ws, 3);
    await sendInputIntents(ws);
    const seen = await withTimeout(snapshotsWaiter, SNAPSHOT_TIMEOUT_MS, "snapshot wait");
    console.log(`[smoke] received ${seen} snapshots after input intents — OK`);
  } catch (err) {
    fail(describeError(err));
  } finally {
    ws.close();
  }
}

await main();
process.exit(process.exitCode ?? 0);
