import {
  PROTOCOL_VERSION,
  TICK_RATE,
  World,
  decodeClientMessage,
  encodeMessage,
  type ContentRegistry,
} from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { GameSim } from "./sim";
import { PlayerStore } from "./store";

/**
 * Thin ws transport around GameSim. Every inbound message is decoded
 * and zod-validated by the engine's protocol module before it touches
 * the sim; anything malformed is dropped (and hello failures close
 * the socket).
 */

export interface ServerOptions {
  port: number;
  worldSeed: number;
  floor: number;
  content: ContentRegistry;
  storeFile?: string | null;
  rngSeed?: number;
}

export interface RunningServer {
  wss: WebSocketServer;
  sim: GameSim;
  store: PlayerStore;
  stop(): void;
}

export function startServer(opts: ServerOptions): RunningServer {
  const world = new World(opts.worldSeed, opts.floor);
  const store = new PlayerStore(opts.storeFile ?? null);
  const sim = new GameSim(
    world,
    opts.content,
    store,
    opts.rngSeed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
  );
  const wss = new WebSocketServer({ port: opts.port });
  const sockets = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    let playerId: string | null = null;

    ws.on("message", (data) => {
      const msg = decodeClientMessage(data.toString());
      if (!msg) {
        if (playerId === null) ws.close(1002, "bad message");
        return;
      }

      switch (msg.type) {
        case "hello": {
          if (playerId !== null) return;
          if (msg.protocol !== PROTOCOL_VERSION) {
            ws.send(
              encodeMessage({
                type: "error",
                code: "protocol_mismatch",
                message: `server speaks protocol ${PROTOCOL_VERSION}`,
              }),
            );
            ws.close(1002, "protocol mismatch");
            return;
          }
          const join = sim.addPlayer(msg.name, msg.clientId, msg.resumeToken);
          playerId = join.playerId;
          const previous = sockets.get(playerId);
          if (previous && previous !== ws) previous.close(1000, "resumed elsewhere");
          sockets.set(playerId, ws);
          ws.send(
            encodeMessage({
              type: "welcome",
              protocol: PROTOCOL_VERSION,
              playerId: join.playerId,
              resumeToken: join.resumeToken,
              worldSeed: opts.worldSeed,
              floor: opts.floor,
              tickRate: TICK_RATE,
              spawn: join.spawn,
            }),
          );
          return;
        }
        case "input":
          if (playerId) sim.handleInput(playerId, msg);
          return;
        case "ping":
          ws.send(encodeMessage({ type: "pong", t: msg.t }));
          return;
        default:
          if (playerId) sim.queueAction(playerId, msg);
          return;
      }
    });

    ws.on("close", () => {
      if (playerId && sockets.get(playerId) === ws) {
        sockets.delete(playerId);
        sim.markDisconnected(playerId);
      }
    });

    ws.on("error", () => {
      /* close handler does the cleanup */
    });
  });

  const interval = setInterval(() => {
    const snapshots = sim.step();
    for (const [id, snapshot] of snapshots) {
      const ws = sockets.get(id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encodeMessage(snapshot));
      }
    }
  }, 1000 / TICK_RATE);

  return {
    wss,
    sim,
    store,
    stop() {
      clearInterval(interval);
      store.flush();
      wss.close();
      for (const ws of sockets.values()) ws.close(1001, "server stopping");
    },
  };
}
