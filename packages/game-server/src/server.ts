import {
  LEVEL,
  LEVEL_IDS,
  PROTOCOL_VERSION,
  TICK_RATE,
  World,
  decodeClientMessage,
  encodeMessage,
  type ClientHello,
  type ClientMessage,
  type ContentRegistry,
  type LevelId,
} from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { GameSim } from "./sim/index.js";
import { PlayerStore } from "./store.js";

/** WebSocket transport: decodes/validates inbound messages, drives every level's GameSim at 20 Hz, broadcasts snapshots. */

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
  const sims = buildSims(opts, store, initialSeed);
  const wss = new WebSocketServer({ port: opts.port });
  const sockets = new Map<string, { ws: WebSocket; sim: GameSim }>();

  wss.on("connection", (ws) => {
    handleConnection(ws, sims, sockets, opts.worldSeed, opts.floor);
  });

  const interval = setInterval(() => broadcastTick(sims, sockets), 1000 / TICK_RATE);

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

function buildSims(
  opts: ServerOptions,
  store: PlayerStore,
  initialSeed: number,
): Record<LevelId, GameSim> {
  return Object.fromEntries(
    LEVEL_IDS.map((level, index) => [
      level,
      new GameSim(new World(opts.worldSeed, opts.floor, level), opts.content, store, initialSeed + index, {
        clusterSpawns: opts.clusterSpawns ?? false,
        debugCommands: opts.debugCommands ?? false,
        testFixtures: opts.testFixtures ?? false,
      }),
    ]),
  ) as Record<LevelId, GameSim>;
}

function broadcastTick(
  sims: Record<LevelId, GameSim>,
  sockets: Map<string, { ws: WebSocket; sim: GameSim }>,
): void {
  for (const level of LEVEL_IDS) {
    const snapshots = sims[level].step();
    for (const [id, snapshot] of snapshots) {
      const socket = sockets.get(id)?.ws;
      if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(snapshot));
    }
  }
}

/** Per-socket join state: mutated in place by handleHello once a player joins. */
interface ConnState {
  playerId: string | null;
  sim: GameSim | null;
}

type SocketMap = Map<string, { ws: WebSocket; sim: GameSim }>;

function handleConnection(
  ws: WebSocket,
  sims: Record<LevelId, GameSim>,
  sockets: SocketMap,
  worldSeed: number,
  floor: number,
): void {
  const conn: ConnState = { playerId: null, sim: null };

  ws.on("message", (data) => {
    const msg = decodeClientMessage(data.toString());
    if (!msg) {
      if (conn.playerId === null) ws.close(1002, "bad message");
      return;
    }
    dispatchMessage(ws, msg, conn, sims, sockets, worldSeed, floor);
  });

  ws.on("close", () => {
    if (conn.playerId && conn.sim && sockets.get(conn.playerId)?.ws === ws) {
      sockets.delete(conn.playerId);
      conn.sim.markDisconnected(conn.playerId);
    }
  });
}

function dispatchMessage(
  ws: WebSocket,
  msg: ClientMessage,
  conn: ConnState,
  sims: Record<LevelId, GameSim>,
  sockets: SocketMap,
  worldSeed: number,
  floor: number,
): void {
  if (msg.type === "hello") {
    handleHello(ws, msg, conn, sims, sockets, worldSeed, floor);
    return;
  }
  if (msg.type === "input") {
    if (conn.playerId && conn.sim) conn.sim.handleInput(conn.playerId, msg);
    return;
  }
  if (msg.type === "ping") {
    ws.send(encodeMessage({ type: "pong", t: msg.t }));
    return;
  }
  if (conn.playerId && conn.sim) conn.sim.queueAction(conn.playerId, msg);
}

function handleHello(
  ws: WebSocket,
  msg: ClientHello,
  conn: ConnState,
  sims: Record<LevelId, GameSim>,
  sockets: SocketMap,
  worldSeed: number,
  floor: number,
): void {
  if (conn.playerId !== null) return;
  if (msg.protocol !== PROTOCOL_VERSION) {
    rejectProtocolMismatch(ws);
    return;
  }
  const sim = sims[msg.level];
  const join = sim.addPlayer(msg.name, msg.clientId, msg.resumeToken);
  conn.playerId = join.playerId;
  conn.sim = sim;
  const previous = sockets.get(join.playerId);
  if (previous && previous.ws !== ws) previous.ws.close(1000, "resumed elsewhere");
  sockets.set(join.playerId, { ws, sim });
  sendWelcome(ws, join, msg.level, worldSeed, floor);
}

function rejectProtocolMismatch(ws: WebSocket): void {
  ws.send(
    encodeMessage({
      type: "error",
      code: "protocol_mismatch",
      message: `server speaks protocol ${PROTOCOL_VERSION}`,
    }),
  );
  ws.close(1002, "protocol mismatch");
}

function sendWelcome(
  ws: WebSocket,
  join: ReturnType<GameSim["addPlayer"]>,
  level: LevelId,
  worldSeed: number,
  floor: number,
): void {
  ws.send(
    encodeMessage({
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      playerId: join.playerId,
      resumeToken: join.resumeToken,
      worldSeed,
      floor,
      level,
      tickRate: TICK_RATE,
      spawn: join.spawn,
    }),
  );
}
