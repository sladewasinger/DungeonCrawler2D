/** Production deployment smoke test: verifies HTML delivery and overworld WebSocket snapshots. */
import { readFileSync } from "node:fs";
import process from "node:process";
import WebSocket from "ws";

const TIMEOUT_MS = 10_000;

function readProtocolVersion() {
  const src = readFileSync(new URL("../packages/engine/src/net/protocol.ts", import.meta.url), "utf8");
  const match = src.match(/PROTOCOL_VERSION\s*=\s*(\d+)/);
  if (!match) throw new Error("PROTOCOL_VERSION not found in protocol.ts");
  return Number(match[1]);
}

function buildWsUrl(siteUrl) {
  const url = new URL(siteUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function checkHtml(siteUrl) {
  const response = await fetch(siteUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${siteUrl}`);
  const html = await response.text();
  if (!html.includes("<div id=\"app\">")) throw new Error("Missing #app mount in HTML");
}

function verifySocket(wsUrl, protocolVersion) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let playerId = "";
    let snapshots = 0;
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("WebSocket smoke timeout")); }, TIMEOUT_MS);
    const finish = (err) => {
      clearTimeout(timer);
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (err) reject(err); else resolve();
    };
    ws.on("error", finish);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", version: protocolVersion, name: "SmokeTest" })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.t === "welcome") { playerId = msg.playerId; sendTestInputs(ws); return; }
      if (msg.t === "snapshot" && msg.players?.some((p) => p.id === playerId) && ++snapshots >= 2) finish();
    });
  });
}

function sendTestInputs(ws) {
  for (let seq = 1; seq <= 3; seq++) {
    ws.send(JSON.stringify({ t: "input", seq, moveX: 1, moveY: 0 }));
  }
}

async function main() {
  const siteUrl = process.argv[2];
  if (!siteUrl) throw new Error("Usage: node tools/smoke-production.mjs <siteUrl>");
  const protocolVersion = readProtocolVersion();
  await checkHtml(siteUrl);
  await verifySocket(buildWsUrl(siteUrl), protocolVersion);
  console.log(`[smoke] PASS: ${siteUrl} (protocol v${protocolVersion})`);
}

main().catch((err) => {
  console.error("[smoke] FAIL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
