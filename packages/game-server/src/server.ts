import {
  LEVEL,
  LEVEL_IDS,
  PROTOCOL_VERSION,
  TICK_RATE,
  World,
  decodeClientMessage,
  encodeMessage,
  type ContentRegistry,
  type LevelId,
} from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { GameSim } from "./sim";
import { PlayerStore } from "./store";

export interface ServerOptions {
  port: number;
  worldSeed: number;
  floor: number;
  content: ContentRegistry;
  storeFile?: string | null;
  rngSeed?: number;
  clusterSpawns?: boolean;
  debugCommands?: boolean;
  testFixtures?: boolean;
}

export interface RunningServer {
  wss: WebSocketServer;
  sim: GameSim;
  sims: Record<LevelId, GameSim>;
  store: PlayerStore;
  stop(): void;
}

export function startServer(opts: ServerOptions): RunningServer {
  const store = new PlayerStore(opts.storeFile ?? null);
  const initialSeed = opts.rngSeed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const sims = Object.fromEntries(
    LEVEL_IDS.map((level, index) => [
      level,
      new GameSim(
        new World(opts.worldSeed, opts.floor, level),
        opts.content,
        store,
        initialSeed + index,
        {
          clusterSpawns: opts.clusterSpawns ?? false,
          debugCommands: opts.debugCommands ?? false,
          testFixtures: opts.testFixtures ?? false,
        },
      ),
    ]),
  ) as Record<LevelId, GameSim>;
  const wss = new WebSocketServer({ port: opts.port });
  const sockets = new Map<string, { ws: WebSocket; sim: GameSim }>();

  wss.on("connection", (ws) => {
    let playerId: string | null = null;
    let sim: GameSim | null = null;

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
          sim = sims[msg.level];
          const join = sim.addPlayer(msg.name, msg.clientId, msg.resumeToken);
          playerId = join.playerId;
          const previous = sockets.get(playerId);
          if (previous && previous.ws !== ws) previous.ws.close(1000, "resumed elsewhere");
          sockets.set(playerId, { ws, sim });
          ws.send(
            encodeMessage({
              type: "welcome",
              protocol: PROTOCOL_VERSION,
              playerId: join.playerId,
              resumeToken: join.resumeToken,
              worldSeed: opts.worldSeed,
              floor: opts.floor,
              level: msg.level,
              tickRate: TICK_RATE,
              spawn: join.spawn,
            }),
          );
          return;
        }
        case "input":
          if (playerId && sim) sim.handleInput(playerId, msg);
          return;
        case "ping":
          ws.send(encodeMessage({ type: "pong", t: msg.t }));
          return;
        default:
          if (playerId && sim) sim.queueAction(playerId, msg);
      }
    });

    ws.on("close", () => {
      if (playerId && sim && sockets.get(playerId)?.ws === ws) {
        sockets.delete(playerId);
        sim.markDisconnected(playerId);
      }
    });
  });

  const interval = setInterval(() => {
    for (const level of LEVEL_IDS) {
      const snapshots = sims[level].step();
      for (const [id, snapshot] of snapshots) {
        const socket = sockets.get(id)?.ws;
        if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(snapshot));
      }
    }
  }, 1000 / TICK_RATE);

  return {
    wss,
    sim: sims[LEVEL.Dungeon],
    sims,
    store,
    stop() {
      clearInterval(interval);
      store.flush();
      wss.close();
      for (const { ws } of sockets.values()) ws.close(1001, "server stopping");
    },
  };
}
