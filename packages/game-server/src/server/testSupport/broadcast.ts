import type { ServerSnapshotDelta } from "@dc2d/engine";
import { WebSocket } from "ws";
import { makeSim } from "../../sim/integration/support.js";
import type { PreparedSnapshotDelivery } from "../../sim/snapshots.js";
import type { SocketMap } from "../types.js";

export interface FakeSocket {
  readyState: number;
  bufferedAmount: number;
  sent: string[];
  send(payload: string): void;
}

export function socket(readyState: number, onSend?: (payload: string) => void): FakeSocket {
  const sent: string[] = [];
  return {
    readyState,
    bufferedAmount: 0,
    sent,
    send(payload) {
      onSend?.(payload);
      sent.push(payload);
    },
  };
}

export function asDelta(delivery: PreparedSnapshotDelivery): ServerSnapshotDelta {
  if (delivery.snapshot.type !== "snapshotDelta") throw new Error("expected delta");
  return delivery.snapshot;
}

export function nextPrepared(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
): PreparedSnapshotDelivery {
  for (let attempts = 0; attempts < 2; attempts++) {
    const delivery = sim.stepPreparedReplicated().get(playerId);
    if (delivery) return delivery;
  }
  throw new Error("snapshot cadence exceeded two ticks");
}

export function socketsFor(
  playerId: string,
  sim: ReturnType<typeof makeSim>,
  fake: FakeSocket,
): SocketMap {
  return new Map([[playerId, { ws: fake as unknown as WebSocket, sim }]]);
}

export function nearbyWalkable(
  sim: ReturnType<typeof makeSim>,
  originX: number,
  originY: number,
): { x: number; y: number } {
  for (let distance = 1; distance <= 4; distance++) {
    const candidates = [
      { x: originX + distance, y: originY },
      { x: originX - distance, y: originY },
      { x: originX, y: originY + distance },
      { x: originX, y: originY - distance },
    ];
    const candidate = candidates.find(({ x, y }) => sim.world.isWalkable(x, y));
    if (candidate) return candidate;
  }
  throw new Error("missing nearby walkable area tile");
}
