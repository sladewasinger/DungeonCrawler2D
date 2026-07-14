import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import WebSocket from "ws";

const siteUrl = new URL(process.argv[2] ?? "https://dungeoncrawl2d.austinwasinger.com");
const constants = await readFile(new URL("../packages/engine/src/core/constants.ts", import.meta.url), "utf8");
const protocolMatch = constants.match(/PROTOCOL_VERSION\s*=\s*(\d+)/);
if (!protocolMatch) throw new Error("Could not read PROTOCOL_VERSION");
const protocol = Number(protocolMatch[1]);

const indexResponse = await fetch(siteUrl, { headers: { "cache-control": "no-cache" } });
if (!indexResponse.ok) throw new Error(`Site returned HTTP ${indexResponse.status}`);
const indexHtml = await indexResponse.text();
const scriptPath = indexHtml.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
if (!scriptPath) throw new Error("Production index did not reference a JavaScript bundle");
const scriptResponse = await fetch(new URL(scriptPath, siteUrl));
if (!scriptResponse.ok) throw new Error(`Client bundle returned HTTP ${scriptResponse.status}`);

for (const level of ["dungeon", "sandbox"]) await join(level);
console.log(`Production smoke passed for dungeon and sandbox on protocol ${protocol}`);

function join(level) {
  return new Promise((resolve, reject) => {
    const websocketUrl = new URL("/ws", siteUrl);
    websocketUrl.protocol = siteUrl.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(websocketUrl);
    let welcomed = false;
    const timeout = setTimeout(() => fail(new Error(`${level} join timed out`)), 15_000);

    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "hello",
          protocol,
          name: "DeploySmoke",
          clientId: `smoke-${randomUUID()}`,
          level,
        }),
      );
    });
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === "error") {
        fail(new Error(`${level} join failed: ${message.code} ${message.message}`));
      } else if (message.type === "welcome") {
        welcomed = true;
      } else if (message.type === "snapshot" && welcomed) {
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    });
    socket.on("error", fail);
    socket.on("close", () => {
      if (!welcomed) fail(new Error(`${level} socket closed before welcome`));
    });

    function fail(error) {
      clearTimeout(timeout);
      socket.terminate();
      reject(error);
    }
  });
}
