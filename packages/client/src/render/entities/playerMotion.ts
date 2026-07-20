// Player motion inference: snapshots carry another player's position but not their
// velocity, so idle/walk (the visual states) come from the position delta since the
// last sample; the brief server-sent attack pulse always wins.
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER, type EnemyAnimationState } from "@dc2d/engine";

const MOVING_EPS_TILES_PER_SEC = 0.4;
/**
 * Epic 7.12: running has no dedicated animation frames (only idle/run are
 * baked — see animState.ts's doc comment), so it reads as the existing walk
 * loop played faster. Movement is server-authoritative, so a genuinely
 * running body's position delta is genuinely faster — this threshold, not a
 * wire field, is what "replicates" run state to observers for free, self
 * included (docs/ASSUMPTIONS.md #66).
 */
const RUNNING_EPS_TILES_PER_SEC = (MOVE_SPEED + MOVE_SPEED * RUN_SPEED_MULTIPLIER) / 2;

/** idle/walk/attack for a player entity, from its position delta since the last sample. */
export function inferPlayerAnimState(
  dxTiles: number,
  dyTiles: number,
  dtSeconds: number,
  attacking: boolean,
): EnemyAnimationState {
  if (attacking) return "attack";
  if (dtSeconds <= 0) return "idle";
  const speed = Math.hypot(dxTiles, dyTiles) / dtSeconds;
  return speed > MOVING_EPS_TILES_PER_SEC ? "walk" : "idle";
}

/** True when the position delta since the last sample reads as running, not walking. */
export function isRunningPace(dxTiles: number, dyTiles: number, dtSeconds: number): boolean {
  if (dtSeconds <= 0) return false;
  return Math.hypot(dxTiles, dyTiles) / dtSeconds > RUNNING_EPS_TILES_PER_SEC;
}
