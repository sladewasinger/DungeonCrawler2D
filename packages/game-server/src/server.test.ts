import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  PROTOCOL_VERSION,
  buildContentRegistry,
  decodeServerMessage,
  encodeMessage,
  hashString,
  type LevelId,
  type ServerWelcome,
} from "@dc2d/engine";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "./server.js";

const content = buildContentRegistry({
  statuses: statusesData as unknown[],
  rules: rulesData as unknown[],
  areas: areasData as unknown[],
  items: itemsData as unknown[],
  enemies: enemiesData as unknown[],
  recipes: recipesData as unknown[],
});

function waitForListening(server: RunningServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.wss.once("listening", resolve);
    server.wss.once("error", reject);
  });
}

function join(port: number, level: LevelId): Promise<{ socket: WebSocket; welcome: ServerWelcome }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.once("error", reject);
    socket.once("open", () => {
      socket.send(
        encodeMessage({
          type: "hello",
          protocol: PROTOCOL_VERSION,
          name: `Crawler-${level}`,
          clientId: `client-${level}`,
          level,
        }),
      );
    });
    socket.on("message", (raw) => {
      const message = decodeServerMessage(raw.toString());
      if (message?.type !== "welcome") return;
      socket.off("error", reject);
      resolve({ socket, welcome: message });
    });
  });
}

describe("level loader", () => {
  it("routes each title-screen selection to its own level simulation", async () => {
    const server = startServer({
      port: 0,
      worldSeed: hashString("server-level-test"),
      floor: 1,
      content,
      storeFile: null,
      rngSeed: 12,
    });
    await waitForListening(server);
    const address = server.wss.address() as AddressInfo;
    const dungeon = await join(address.port, "dungeon");
    const sandbox = await join(address.port, "sandbox");
    try {
      expect(dungeon.welcome.level).toBe("dungeon");
      expect(sandbox.welcome.level).toBe("sandbox");
      expect(server.sims.dungeon.playerCount).toBe(1);
      expect(server.sims.sandbox.playerCount).toBe(1);
      expect(server.sims.sandbox.enemyCount).toBe(0);
    } finally {
      dungeon.socket.close();
      sandbox.socket.close();
      server.stop();
    }
  });

  it("rejects a hello whose protocol version does not match the server", async () => {
    const server = startServer({
      port: 0,
      worldSeed: hashString("server-protocol-test"),
      floor: 1,
      content,
      storeFile: null,
      rngSeed: 12,
    });
    await waitForListening(server);
    const address = server.wss.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    try {
      const error = await new Promise((resolve, reject) => {
        socket.once("error", reject);
        socket.once("open", () => {
          socket.send(
            encodeMessage({
              type: "hello",
              protocol: PROTOCOL_VERSION + 1,
              name: "Mismatched",
              clientId: "client-mismatch",
              level: "dungeon",
            }),
          );
        });
        socket.on("message", (raw) => {
          const message = decodeServerMessage(raw.toString());
          if (message?.type === "error") resolve(message);
        });
      });
      expect(error).toMatchObject({ type: "error", code: "protocol_mismatch" });
    } finally {
      socket.close();
      server.stop();
    }
  });
});
