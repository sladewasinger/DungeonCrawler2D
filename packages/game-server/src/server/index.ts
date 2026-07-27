import { LEVEL, World, type ContentRegistry, type LevelId } from "@dc2d/engine";
import { WebSocketServer, type WebSocket } from "ws";
import { FloorRegistry } from "../floorRegistry.js";
import { GameSim } from "../sim/index.js";
import { PlayerStore } from "../store.js";
import { broadcastTick } from "./broadcast.js";
import { handleConnection } from "./dispatch.js";
import { startFixedRateLoop } from "./fixedRateLoop.js";
import { startHeartbeat } from "./heartbeat.js";
import { ServerNetworkDiagnostics } from "./networkDiagnostics.js";
import type { SocketMap } from "./types.js";

/** WebSocket transport facade: decodes/validates inbound messages,
 * drives every level's simulation at 20 Hz, broadcasts snapshots.
 * Epic 7.14 (The Descent): the "dungeon" level is now a FloorRegistry of
 * per-floor sims (floor 1 is the pre-existing base sim); "sandbox" is
 * unchanged. Message routing lives in dispatch.ts, the tick loop in
 * broadcast.ts — this file only owns construction and lifecycle. */

export interface ServerOptions {
  port: number;
  worldSeed: number;
  /** Epic 7.14: only pins the "sandbox" level's floor now — the
   * "dungeon" level's floors are always the absolute range 1..FLOOR_CAP
   * (ASSUMPTION #133, docs/ASSUMPTIONS.md). */
  floor: number;
  content: ContentRegistry;
  storeFile?: string | null;
  rngSeed?: number;
  clusterSpawns?: boolean;
  /** See SimState["opts"].spawnRadiusTiles (sim/state.ts) for semantics. */
  spawnRadiusTiles?: number | undefined;
  debugCommands?: boolean;
  freezeEnemies?: boolean;
  testFixtures?: boolean;
}

export interface RunningServer {
  wss: WebSocketServer;
  sim: GameSim;
  sims: Record<LevelId, GameSim>;
  /** Epic 7.14: the dungeon level's per-floor sim registry. */
  floors: FloorRegistry;
  store: PlayerStore;
  networkMetrics: ServerNetworkDiagnostics;
  stop(): void;
}

export function startServer(opts: ServerOptions): RunningServer {
  const store = new PlayerStore(opts.storeFile ?? null);
  const initialSeed = opts.rngSeed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const simOpts = simulationOptions(opts);
  const { floors, sandbox } = createSimulations({ opts, store, seed: initialSeed, simOpts });
  const wss = new WebSocketServer({ port: opts.port });
  const sockets: SocketMap = new Map();
  const networkMetrics = new ServerNetworkDiagnostics();
  const stopHeartbeat = connectWebSockets(wss, { floors, sandbox, sockets, worldSeed: opts.worldSeed, diagnostics: networkMetrics });
  const stopTickLoop = startFixedRateLoop(() => broadcastTick({ floors, sandbox, sockets, diagnostics: networkMetrics }));

  return {
    wss,
    sim: floors.base,
    sims: { dungeon: floors.base, sandbox },
    floors,
    store,
    networkMetrics,
    stop: () => stopServer({ stopTickLoop, stopHeartbeat, store, wss, sockets }),
  };
}

function simulationOptions(opts: ServerOptions): GameSim["state"]["opts"] {
  return {
    clusterSpawns: opts.clusterSpawns ?? false,
    spawnRadiusTiles: opts.spawnRadiusTiles,
    debugCommands: opts.debugCommands ?? false,
    freezeEnemies: opts.freezeEnemies ?? false,
    testFixtures: opts.testFixtures ?? false,
  };
}

interface SimulationCreation {
  opts: ServerOptions;
  store: PlayerStore;
  seed: number;
  simOpts: GameSim["state"]["opts"];
}

function createSimulations({ opts, store, seed, simOpts }: SimulationCreation): { floors: FloorRegistry; sandbox: GameSim } {
  return {
    floors: new FloorRegistry({ worldSeed: opts.worldSeed, content: opts.content, store, rngSeedBase: seed, opts: simOpts }),
    sandbox: new GameSim({ world: new World(opts.worldSeed, opts.floor, LEVEL.Sandbox), content: opts.content, store: store, rngSeed: seed + 1000, opts: simOpts }),
  };
}

function connectWebSockets(wss: WebSocketServer, context: Parameters<typeof handleConnection>[1]): () => void {
  const stopHeartbeat = startHeartbeat(wss);
  wss.on("connection", (ws: WebSocket) => handleConnection(ws, context));
  return stopHeartbeat;
}

interface StopServerContext {
  stopTickLoop: () => void;
  stopHeartbeat: () => void;
  store: PlayerStore;
  wss: WebSocketServer;
  sockets: SocketMap;
}

function stopServer({ stopTickLoop, stopHeartbeat, store, wss, sockets }: StopServerContext): void {
  stopTickLoop();
  stopHeartbeat();
  store.flush();
  wss.close();
  for (const { ws } of sockets.values()) ws.close(1001, "server stopping");
}
