// Player motion inference: snapshots carry another player's position but not their
// velocity, so idle/walk (the visual states) come from the position delta since the
// last sample; the brief server-sent attack pulse always wins.
import type { EnemyAnimationState } from "@dc2d/engine";

const MOVING_EPS_TILES_PER_SEC = 0.4;

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
