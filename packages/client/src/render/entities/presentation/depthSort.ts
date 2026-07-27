// One feet/edge depth axis shared by entities and terrain occluders. A wall edge
// sorts in front of feet north of it and behind feet south of it.
export const BASE_TERRAIN_DEPTH = -1_000_000_000;

/** Wide row spacing leaves room for small same-row presentation biases. */
const ROW_STEP = 100;
/** A same-row tie-break only: far smaller than ROW_STEP. */
const LIFT_STEP = 0.01;
const OCCLUDER_BIAS = 0.5;
/** Ground effects sit just above their floor cap, but below every entity in that row. */
export const GROUND_EFFECT_BIAS = 0.04;
/** Small presentation lift used by held weapons and attack-cone indicators. */
export const COMBAT_OVERLAY_BIAS = 0.08;

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

/**
 * Depth band for decals and other visuals that lie on a tile's ground surface.
 *
 * This is intentionally a row-local band rather than a global Phaser layer: the
 * floor cap must be behind the effect, while every entity standing in that same
 * row must remain in front of it. A whole decal must therefore stay within its
 * owner row; callers that span rows must split into row-local fragments.
 */
export function depthForGroundEffect(rowY: number): number {
  return depthForCapOccluder(Math.floor(rowY)) + GROUND_EFFECT_BIAS;
}

/**
 * Depth for combat visuals that should sit over the player's immediate
 * screen-south terrain, unless that floor is genuinely higher than the player.
 */
export function depthForAdjacentTerrainOverlay(
  wielderViewY: number,
  wielderDepth: number,
  screenSouthFloorHigher: boolean,
): number {
  if (screenSouthFloorHigher) return wielderDepth + COMBAT_OVERLAY_BIAS;
  return depthForOccluder(Math.floor(wielderViewY) + 1) + COMBAT_OVERLAY_BIAS;
}

export interface DepthKey {
  readonly feetWorldY: number;
  readonly liftUnits?: number;
}

/** Sort comparator: entities further south (larger feet Y) draw after — in front of — those further north. */
export function compareEntityDepth(a: DepthKey, b: DepthKey): number {
  return depthForEntity(a.feetWorldY, a.liftUnits ?? 0) - depthForEntity(b.feetWorldY, b.liftUnits ?? 0);
}
