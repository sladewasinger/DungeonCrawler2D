// Collapsed tower landmark (ruins district): concentric rings stepping up
// +2 per tier toward a rubble-strewn core — climbable tier by tier, exactly
// the jump-apex language the rest of the world uses. Anchored DIAGONALLY off
// the chunk's own corridor-junction point (same trick as
// features/platforms.ts's clusterCenter): the junction is where local
// corridor arms actually converge, so a tower centered ON it would have its
// climbable core carved flat by crossing traffic. Off to the side, roads
// still braid through its rubble apron, but the peak stands intact.

import { hash2D, mixSeeds } from "../../../core/rng.js";
import { CHUNK_SIZE, TILE } from "../../types.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor, type LandmarkCenter } from "./shared.js";

const OUTER_RADIUS = 9;
const RING_STEP = 3; // tiles per tier
export const TIER_RISE = 2; // height per tier — the jumpable step
/** The tower's peak height (core tier), for tests bounding the world's overall height budget. */
export const TOWER_MAX_RISE = Math.floor(OUTER_RADIUS / RING_STEP) * TIER_RISE;
const RUBBLE_CHANCE_DENOM = 6;
const JUNCTION_CLEARANCE = 11; // clears the busiest crossing traffic near the junction

const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function towerCenter(seed: number, worldSeed: number, floor: number, cx: number, cy: number): LandmarkCenter {
  const junction = landmarkCenter(worldSeed, floor, cx, cy);
  const pick = hash2D(mixSeeds(seed, 0x7012), cx, cy) % DIAG.length;
  const [ddx, ddy] = DIAG[pick] ?? [1, 1];
  const clamp = (v: number) => Math.max(1, Math.min(CHUNK_SIZE - 2, v));
  return {
    lx: clamp(junction.lx + ddx * JUNCTION_CLEARANCE),
    ly: clamp(junction.ly + ddy * JUNCTION_CLEARANCE),
  };
}

function tierRise(d: number): number {
  const tier = Math.max(0, Math.floor((OUTER_RADIUS - d) / RING_STEP));
  return tier * TIER_RISE;
}

function isRubble(seed: number, wx: number, wy: number): boolean {
  return hash2D(mixSeeds(seed, 0x7011), wx, wy) % RUBBLE_CHANCE_DENOM === 0;
}

export function stampTower(
  seed: number,
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  corridorCarved: Uint8Array,
  tiles: Uint8Array,
  height: Float32Array,
): void {
  const center = towerCenter(seed, worldSeed, floor, cx, cy);
  forEachLandmarkTile(center, OUTER_RADIUS, (lx, ly, dx, dy) => {
    const i = ly * CHUNK_SIZE + lx;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d > OUTER_RADIUS) return;
    const carved = onCorridor(corridorCarved, CHUNK_SIZE, lx, ly);
    const wx = cx * CHUNK_SIZE + lx;
    const wy = cy * CHUNK_SIZE + ly;
    const rubble = !carved && d < OUTER_RADIUS - RING_STEP && isRubble(seed, wx, wy);
    tiles[i] = rubble ? TILE.Wall : TILE.Floor;
    height[i] = carved ? 0 : tierRise(d);
  });
}
