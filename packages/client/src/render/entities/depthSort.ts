// Feet-anchored depth sort: keeps every entity strictly between terrain's below layer
// (floors, depth 0) and above layer (wall caps/occlusion bands, depth 100 — see
// render/terrain/index.ts BELOW_DEPTH/ABOVE_DEPTH) so a wall's cap always occludes
// whoever stands north of it, and floors never occlude anyone, from Phaser's own
// depth ordering alone — no per-tile bookkeeping needed.
const TERRAIN_BELOW_DEPTH = 0;
const TERRAIN_ABOVE_DEPTH = 100;
const ENTITY_DEPTH_MID = (TERRAIN_BELOW_DEPTH + TERRAIN_ABOVE_DEPTH) / 2;

/** Depth change per world tile of feet Y — a ~2000-tile world either side of center still lands inside the band. */
const ROW_STEP = 0.02;
/** A same-row tie-break only: far smaller than ROW_STEP so it can never invert two entities a tile apart. */
const LIFT_STEP = 0.002;

const DEPTH_MIN = TERRAIN_BELOW_DEPTH + 1;
const DEPTH_MAX = TERRAIN_ABOVE_DEPTH - 1;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Phaser depth for an entity whose feet are at `feetWorldY`, `liftUnits` above its ground height. */
export function depthForEntity(feetWorldY: number, liftUnits = 0): number {
  const raw = ENTITY_DEPTH_MID + feetWorldY * ROW_STEP + liftUnits * LIFT_STEP;
  return clamp(raw, DEPTH_MIN, DEPTH_MAX);
}

export interface DepthKey {
  readonly feetWorldY: number;
  readonly liftUnits?: number;
}

/** Sort comparator: entities further south (larger feet Y) draw after — in front of — those further north. */
export function compareEntityDepth(a: DepthKey, b: DepthKey): number {
  return depthForEntity(a.feetWorldY, a.liftUnits ?? 0) - depthForEntity(b.feetWorldY, b.liftUnits ?? 0);
}
