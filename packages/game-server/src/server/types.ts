import type { WebSocket } from "ws";
import type { GameSim } from "../sim/index.js";

/** Shared per-socket bookkeeping types for the ws transport (server/). */

export type SocketEntry = { ws: WebSocket; sim: GameSim };
export type SocketMap = Map<string, SocketEntry>;

/** Per-socket join state: mutated in place by handleHello once a player joins. */
export interface ConnState {
  playerId: string | null;
}
