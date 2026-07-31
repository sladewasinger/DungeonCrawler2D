import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import type { ServerOptions } from "../index.js";
import { createAdminRuntime } from "../admin/adminRuntime.js";
import { broadcastTick } from "../broadcast.js";
import { handleConnection } from "../connection/connectionHandler.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { SocketMap } from "../types.js";
import type { SpectatorSubscriptions } from "../spectator/spectatorSubscriptions.js";

export interface ConnectionContextInput {
  readonly opts: ServerOptions;
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim;
  readonly sockets: SocketMap;
  readonly networkMetrics: ServerNetworkDiagnostics;
  readonly admin: ReturnType<typeof createAdminRuntime>["controller"];
  readonly adminAccess: ReturnType<typeof createAdminRuntime>["access"];
  readonly adminSessions: ReturnType<typeof createAdminRuntime>["sessions"];
  readonly adminSubscriptions: ReturnType<typeof createAdminRuntime>["subscriptions"];
  readonly operationalEvents: OperationalEventSink;
  readonly spectatorSubscriptions: SpectatorSubscriptions;
}

export function createConnectionContext(
  input: ConnectionContextInput,
): Parameters<typeof handleConnection>[1] {
  const { opts, floors, sandbox, combatSandbox, sockets, networkMetrics, admin, adminAccess, adminSessions, adminSubscriptions, spectatorSubscriptions, operationalEvents } = input;
  return {
    floors,
    sandbox,
    combatSandbox,
    sockets,
    seedInputText: opts.seedInputText ?? String(opts.worldSeed),
    worldSeed: opts.worldSeed,
    diagnostics: networkMetrics,
    admin,
    adminToken: opts.adminToken ?? null,
    adminAccess,
    adminSessions,
    adminSubscriptions,
    spectatorSubscriptions,
    trustProxy: opts.trustProxy ?? false,
    operationalEvents,
    ...(opts.operationalEventPepper ? { operationalEventPepper: opts.operationalEventPepper } : {}),
  };
}

export function createBroadcastContext(
  input: Omit<ConnectionContextInput, "adminAccess" | "adminSessions" | "operationalEvents">,
): Parameters<typeof broadcastTick>[0] {
  const { opts, floors, sandbox, combatSandbox, sockets, networkMetrics, admin, adminSubscriptions, spectatorSubscriptions } = input;
  return {
    floors,
    sandbox,
    combatSandbox,
    sockets,
    diagnostics: networkMetrics,
    admin,
    adminSubscriptions,
    spectatorSubscriptions,
    ...(opts.gameplayIdleTimeoutMs ? { gameplayIdleTimeoutMs: opts.gameplayIdleTimeoutMs } : {}),
  };
}
