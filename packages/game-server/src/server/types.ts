import type { WebSocket } from "ws";
import type { GameSim } from "../sim/core/index.js";
import type { AdminSession } from "./admin/access/authorization.js";
import type { SpectatorSession } from "./admin/spectator/spectatorSession.js";

/** Shared per-socket bookkeeping types for the ws transport (server/). */

export type SocketEntry = { ws: WebSocket; sim: GameSim; conn?: ConnState };
export type SocketMap = Map<string, SocketEntry>;

export type ConnectionTerminationReason =
  | "admin_rate_limited"
  | "floor_preparation_failed"
  | "idle_timeout"
  | "malformed_message"
  | "protocol_mismatch"
  | "resumed_elsewhere";

/** Per-socket join state: mutated in place by handleHello once a player joins. */
export interface ConnState {
  playerId: string | null;
  lastMeaningfulActivityAt: number | null;
  lastAim: { x: number; y: number } | null;
  idleTimedOut: boolean;
  terminationReason: ConnectionTerminationReason | null;
  peerFingerprint: string | null;
  adminSession: AdminSession | null;
  peerAddress: string;
  spectator: SpectatorSession;
}
