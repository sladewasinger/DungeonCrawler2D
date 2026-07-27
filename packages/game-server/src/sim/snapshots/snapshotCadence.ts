/** Chooses per-client snapshot cadence from delivery-critical and nearby dynamic state. */
import type { PlayerSnapshotFrame } from "./playerSnapshot.js";

export const SNAPSHOT_BASE_INTERVAL_TICKS = 2;
const MOTION_EPSILON = 0.001;

function hasNearbyDynamicState(frame: PlayerSnapshotFrame): boolean {
  return frame.entities.some(({ snapshot }) =>
    Math.abs(snapshot.vx ?? 0) > MOTION_EPSILON ||
    Math.abs(snapshot.vy ?? 0) > MOTION_EPSILON ||
    Math.abs(snapshot.vz ?? 0) > MOTION_EPSILON ||
    (snapshot.anim !== undefined && snapshot.anim !== "idle"));
}

/** Critical state bypasses the base 10 Hz cadence; active AOI actors burst at 20 Hz. */
export function shouldSendSnapshot(
  frame: PlayerSnapshotFrame,
  needsBaseline: boolean,
): boolean {
  if (needsBaseline) return true;
  if (frame.includesFullAreas) return true;
  if (frame.tick % SNAPSHOT_BASE_INTERVAL_TICKS === 0) return true;
  if (frame.events.length > 0 || frame.areas.length > 0 || frame.left.length > 0) return true;
  return hasNearbyDynamicState(frame);
}
