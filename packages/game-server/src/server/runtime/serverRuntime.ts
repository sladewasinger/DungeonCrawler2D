import {
  DEFAULT_WORLD_FEATURES,
  LEVEL,
  World,
} from "@dc2d/engine";
import { WebSocketServer } from "ws";
import { FloorRegistry } from "../../floors/floorRegistry.js";
import { GameSim } from "../../sim/core/index.js";
import { PlayerStore } from "../../store.js";
import type { ServerOptions } from "../index.js";
import { createAdminRuntime } from "../admin/adminRuntime.js";
import type { MemoryAdminAuditSink } from "../admin/audit.js";
import { broadcastTick } from "../broadcast.js";
import { handleConnection } from "../connection/connectionHandler.js";
import { NullOperationalEventSink, type OperationalEventSink } from "../operations/operationalEvent.js";
import { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { SocketMap } from "../types.js";
import { createBroadcastContext, createConnectionContext } from "./serverRuntimeContext.js";
import { SpectatorDirectory } from "../spectator/spectatorDirectory.js";
import { SpectatorSubscriptions } from "../spectator/spectatorSubscriptions.js";

export interface ServerRuntime {
  readonly wss: WebSocketServer;
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly store: PlayerStore;
  readonly sockets: SocketMap;
  readonly networkMetrics: ServerNetworkDiagnostics;
  readonly adminAudit: MemoryAdminAuditSink;
  readonly operationalEvents: OperationalEventSink;
  readonly spectatorSubscriptions: SpectatorSubscriptions;
  readonly context: Parameters<typeof handleConnection>[1];
  readonly tickContext: Parameters<typeof broadcastTick>[0];
}

export function createServerRuntime(opts: ServerOptions): ServerRuntime {
  const foundation = createRuntimeFoundation(opts);
  const operationalEvents = opts.operationalEvents ?? new NullOperationalEventSink();
  const adminRuntime = createAdminRuntime({
    floors: foundation.floors,
    sandbox: foundation.sandbox,
    operationalEvents,
  });
  return assembleRuntime({ opts, foundation, adminRuntime, operationalEvents });
}

export { connectWebSockets } from "./serverConnections.js";

interface RuntimeFoundation {
  readonly wss: WebSocketServer;
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly store: PlayerStore;
  readonly sockets: SocketMap;
  readonly networkMetrics: ServerNetworkDiagnostics;
}

function createRuntimeFoundation(opts: ServerOptions): RuntimeFoundation {
  const store = new PlayerStore(opts.storeFile ?? null);
  const seed = runtimeSeed(opts.rngSeed);
  const simulations = createSimulations({ opts, store, seed, simOpts: simulationOptions(opts) });
  return {
    store,
    floors: simulations.floors,
    sandbox: simulations.sandbox,
    wss: new WebSocketServer({ port: opts.port, ...(opts.host ? { host: opts.host } : {}) }),
    sockets: new Map(),
    networkMetrics: new ServerNetworkDiagnostics(),
  };
}

interface RuntimeAssemblyInput {
  readonly opts: ServerOptions;
  readonly foundation: RuntimeFoundation;
  readonly adminRuntime: ReturnType<typeof createAdminRuntime>;
  readonly operationalEvents: OperationalEventSink;
}

function assembleRuntime(input: RuntimeAssemblyInput): ServerRuntime {
  const { opts, foundation, adminRuntime, operationalEvents } = input;
  const { floors, sandbox, sockets, networkMetrics } = foundation;
  const { controller: admin, audit: adminAudit, access: adminAccess } = adminRuntime;
  const { sessions: adminSessions, subscriptions: adminSubscriptions } = adminRuntime;
  const spectatorSubscriptions = createSpectatorSubscriptions(input);
  return {
    ...foundation,
    adminAudit,
    operationalEvents,
    spectatorSubscriptions,
    context: createConnectionContext({
      opts,
      floors,
      sandbox,
      sockets,
      networkMetrics,
      admin,
      adminAccess,
      adminSessions,
      adminSubscriptions,
      spectatorSubscriptions,
      operationalEvents,
    }),
    tickContext: createBroadcastContext({ opts, floors, sandbox, sockets, networkMetrics, admin, adminSubscriptions, spectatorSubscriptions }),
  };
}

function createSpectatorSubscriptions(
  input: RuntimeAssemblyInput,
): SpectatorSubscriptions {
  const { opts, foundation } = input;
  return new SpectatorSubscriptions({
    directory: new SpectatorDirectory({
      sockets: foundation.sockets,
      seedInputText: opts.seedInputText ?? String(opts.worldSeed),
      worldSeed: opts.worldSeed,
    }),
    diagnostics: foundation.networkMetrics,
  });
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
  readonly opts: ServerOptions;
  readonly store: PlayerStore;
  readonly seed: number;
  readonly simOpts: GameSim["state"]["opts"];
}

function createSimulations(input: SimulationCreation): { floors: FloorRegistry; sandbox: GameSim } {
  const { opts, store, seed, simOpts } = input;
  const worldFeatures = opts.worldFeatures ?? DEFAULT_WORLD_FEATURES;
  return {
    floors: new FloorRegistry({
      worldSeed: opts.worldSeed,
      content: opts.content,
      store,
      rngSeedBase: seed,
      opts: simOpts,
      worldFeatures,
    }),
    sandbox: new GameSim({
      world: new World(opts.worldSeed, opts.floor, { level: LEVEL.Sandbox, features: worldFeatures }),
      content: opts.content,
      store,
      rngSeed: seed + 1000,
      opts: simOpts,
    }),
  };
}

function runtimeSeed(seed: number | undefined): number {
  return seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
