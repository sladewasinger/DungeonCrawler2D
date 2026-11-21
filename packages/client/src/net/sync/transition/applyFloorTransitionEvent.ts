import type { Connection } from "../../connection/connection.js";

export function beginFloorTransition(conn: Connection, floor: number): void {
  if (floor <= conn.floor || conn.pendingFloorTransition === floor) return;
  conn.worldLoadAttempt++;
  conn.worldLoadCancel?.();
  conn.worldLoadCancel = null;
  conn.pendingFloorTransition = floor;
  conn.worldReady = false;
  conn.worldLoading = true;
  conn.worldLoadError = null;
  conn.pendingWorldSnapshot = null;
  conn.prediction.reset();
  conn.movementCadence.reset();
  conn.predictionCorrection.reset(true);
  conn.onWorldLoading?.();
}
