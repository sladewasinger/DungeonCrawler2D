import type { ServerMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { PreparedSnapshotDelivery } from "../../sim/snapshots/snapshots.js";
import type { SpectatorDirectory } from "./spectatorDirectory.js";
import { publicSpectatorSnapshot } from "./spectatorSnapshot.js";

export interface SpectatorDeliveryTarget {
  readonly socket: WebSocket;
  readonly playerId: string | null;
  needsBaseline: boolean;
}

export function clearDeliveredBaselineRequests(
  targets: Iterable<SpectatorDeliveryTarget>,
  snapshots: Map<string, PreparedSnapshotDelivery>,
): void {
  for (const target of targets) {
    const snapshot = target.playerId ? snapshots.get(target.playerId)?.snapshot : undefined;
    if (snapshot?.type === "snapshot" || snapshot?.baseline) target.needsBaseline = false;
  }
}

export function deliverSpectatorSnapshots(input: {
  readonly targets: Iterable<SpectatorDeliveryTarget>;
  readonly snapshots: Map<string, PreparedSnapshotDelivery>;
  readonly directory: SpectatorDirectory;
  readonly send: (target: SpectatorDeliveryTarget, message: ServerMessage) => void;
}): void {
  const sanitized = new Map<string, ServerMessage>();
  for (const target of input.targets) {
    const playerId = target.playerId;
    const delivery = playerId ? input.snapshots.get(playerId) : undefined;
    if (!playerId || !delivery) continue;
    const message = spectatorMessage({
      playerId,
      delivery,
      directory: input.directory,
      cache: sanitized,
    });
    input.send(target, message);
  }
}

function spectatorMessage(input: {
  readonly playerId: string;
  readonly delivery: PreparedSnapshotDelivery;
  readonly directory: SpectatorDirectory;
  readonly cache: Map<string, ServerMessage>;
}): ServerMessage {
  const cached = input.cache.get(input.playerId);
  if (cached) return cached;
  const message = publicSpectatorSnapshot(
    input.delivery.snapshot,
    input.directory.visibleLoadout(input.playerId),
  );
  input.cache.set(input.playerId, message);
  return message;
}
