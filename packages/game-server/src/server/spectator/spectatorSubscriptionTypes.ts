import type { SpectatorMode } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { ConnState } from "../types.js";
import type { SpectatorDirectory } from "./spectatorDirectory.js";
import type { SpectatorRateWindow } from "./spectatorRateLimits.js";

const MAX_SPECTATORS = 32;
const MAX_SPECTATORS_PER_PEER = 4;

export interface SpectatorSubscription {
  readonly socket: WebSocket;
  readonly connection: ConnState;
  mode: SpectatorMode;
  playerId: string | null;
  worldIdentity: string | null;
  needsBaseline: boolean;
  lastTargetChangeAt: number;
  readonly commandWindow: SpectatorRateWindow;
}

export interface SpectatorSubscriptionOptions {
  readonly directory: SpectatorDirectory;
  readonly diagnostics: ServerNetworkDiagnostics;
}

export function cycleTargetId(
  ids: readonly string[],
  currentId: string | null,
  direction: "next" | "previous",
): string | null {
  if (ids.length === 0) return null;
  const current = ids.indexOf(currentId ?? "");
  const step = direction === "next" ? 1 : -1;
  const start = current < 0 ? (step > 0 ? -1 : 0) : current;
  return ids[(start + step + ids.length) % ids.length] ?? ids[0] ?? null;
}

export function spectatorCapacityReached(
  subscriptions: Iterable<SpectatorSubscription>,
  peerAddress: string,
): boolean {
  const active = [...subscriptions];
  if (active.length >= MAX_SPECTATORS) return true;
  return active.filter(({ connection }) => connection.peerAddress === peerAddress).length >=
    MAX_SPECTATORS_PER_PEER;
}
