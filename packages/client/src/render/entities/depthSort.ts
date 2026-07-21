// One feet/edge depth axis shared by entities and terrain occluders. A wall edge
// sorts in front of feet north of it and behind feet south of it.
export const BASE_TERRAIN_DEPTH = -1_000_000_000;

/** Wide row spacing leaves room for small same-row presentation biases. */
const ROW_STEP = 100;
/** A same-row tie-break only: far smaller than ROW_STEP. */
const LIFT_STEP = 0.01;
const OCCLUDER_BIAS = 0.5;

/** Phaser depth for an entity whose feet are at `feetWorldY`, `liftUnits` above its ground height. */
export function depthForEntity(feetWorldY: number, liftUnits = 0): number {
  return feetWorldY * ROW_STEP + liftUnits * LIFT_STEP;
}

/** A wall at this south edge covers north feet and sits behind south feet. */
export function depthForOccluder(southEdgeWorldY: number): number {
  return depthForEntity(southEdgeWorldY) + OCCLUDER_BIAS;
}

/**
 * A shifted CAP strip keyed to walkable row `capRowY` (chunkVisual.ts's
 * bakeCapRows): covers feet at ANY fractional position strictly north of the
 * row (feetWorldY < capRowY, including e.g. capRowY - 0.5 — the case
 * depthForOccluder(capRowY - 1) missed, leaving a south neighbor's raised cap
 * behind the entity it must occlude), while the row's own occupants
 * (feetWorldY >= capRowY) stay in front of the cap they stand on.
 */
export function depthForCapOccluder(capRowY: number): number {
  return depthForEntity(capRowY) - OCCLUDER_BIAS;
}

export interface DepthKey {
  readonly feetWorldY: number;
  readonly liftUnits?: number;
}

/** Sort comparator: entities further south (larger feet Y) draw after — in front of — those further north. */
export function compareEntityDepth(a: DepthKey, b: DepthKey): number {
  return depthForEntity(a.feetWorldY, a.liftUnits ?? 0) - depthForEntity(b.feetWorldY, b.liftUnits ?? 0);
}
