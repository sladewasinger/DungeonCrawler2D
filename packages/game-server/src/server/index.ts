import { type ContentRegistry, type LevelId, type WorldFeatures } from "@dc2d/engine";
import { type WebSocketServer } from "ws";
import { FloorRegistry } from "../floors/floorRegistry.js";
import { GameSim } from "../sim/core/index.js";
import { PlayerStore } from "../store.js";
import { broadcastTick } from "./broadcast.js";
import { startFixedRateLoop } from "./loop/fixedRateLoop.js";
import { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import type { MemoryAdminAuditSink } from "./admin/audit.js";
import type { OperationalEventSink } from "./operations/operationalEvent.js";
import { connectWebSockets, createServerRuntime } from "./runtime/serverRuntime.js";
import { stopServer } from "./runtime/serverShutdown.js";

/** WebSocket transport facade: decodes/validates inbound messages,
 * drives every level's simulation at 20 Hz, broadcasts snapshots.
 * Epic 7.14 (The Descent): the "dungeon" level is now a FloorRegistry of
 * per-floor sims (floor 1 is the pre-existing base sim); "sandbox" is
 * unchanged. Message routing lives in dispatch.ts, the tick loop in
 * broadcast.ts — this file only owns construction and lifecycle. */

export interface ServerOptions {
  host?: string;
  port: number;
  seedInputText?: string;
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
  worldFeatures?: WorldFeatures;
  /** Secret for the separate admin WebSocket contract; null disables it. */
  adminToken?: string | null;
  /** Trust X-Forwarded-For only when a trusted reverse proxy strips client headers. */
  trustProxy?: boolean;
  /** Disconnect gameplay sockets after this much meaningful inactivity. */
  gameplayIdleTimeoutMs?: number;
  /** Optional DynamoDB-backed operational history; local development omits it. */
  operationalEvents?: OperationalEventSink;
  /** Deployment secret used to make one-way, non-IP peer fingerprints. */
  operationalEventPepper?: string;
}

export interface RunningServer {
  wss: WebSocketServer;
  sim: GameSim;
  sims: Record<LevelId, GameSim>;
  /** Epic 7.14: the dungeon level's per-floor sim registry. */
  floors: FloorRegistry;
  store: PlayerStore;
  networkMetrics: ServerNetworkDiagnostics;
  adminAudit: MemoryAdminAuditSink;
  operationalEvents: OperationalEventSink;
  stop(): void;
  flushOperationalEvents(): Promise<void>;
}

export function startServer(opts: ServerOptions): RunningServer {
  const runtime = createServerRuntime(opts);
  const stopHeartbeat = connectWebSockets(runtime.wss, runtime.context);
  const stopTickLoop = startFixedRateLoop(() => broadcastTick(runtime.tickContext));

  return {
    wss: runtime.wss,
    sim: runtime.floors.base,
    sims: { dungeon: runtime.floors.base, sandbox: runtime.sandbox },
    floors: runtime.floors,
    store: runtime.store,
    networkMetrics: runtime.networkMetrics,
    adminAudit: runtime.adminAudit,
    operationalEvents: runtime.operationalEvents,
    stop: () => stopServer({
      stopTickLoop,
      stopHeartbeat,
      store: runtime.store,
      wss: runtime.wss,
      sockets: runtime.sockets,
      operationalEvents: runtime.operationalEvents,
    }),
    flushOperationalEvents: () => runtime.operationalEvents.flush(),
  };
}
