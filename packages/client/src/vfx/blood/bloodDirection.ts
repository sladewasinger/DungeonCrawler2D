// Splatter direction: a hit's particle cone should point away from the knockback
// impulse when one is available. Today only the local player's own body exposes a
// knockback vector (`BodyState.kx/ky`, self-only per server.ts's selfSnapshotSchema);
// remote entities (other players, enemies) carry no such field on `EntitySnapshot`,
// so their splatter falls back to an even, omnidirectional cone rather than guessing
// a direction (ASSUMPTIONS.md #55) — still directional whenever the signal exists.

export interface AngleWindow {
  readonly minDeg: number;
  readonly maxDeg: number;
}

const DIRECTIONAL_SPREAD_DEG = 70;
const OMNI: AngleWindow = { minDeg: 0, maxDeg: 360 };

/** `dirX`/`dirY` point in the knockback direction (away from the hit); undefined or a
 * zero vector falls back to an omnidirectional spray. */
export function splatterAngleWindow(dirX?: number, dirY?: number): AngleWindow {
  if (!dirX && !dirY) return OMNI;
  const centerDeg = Math.atan2(dirY ?? 0, dirX ?? 0) * (180 / Math.PI);
  return { minDeg: centerDeg - DIRECTIONAL_SPREAD_DEG / 2, maxDeg: centerDeg + DIRECTIONAL_SPREAD_DEG / 2 };
}
