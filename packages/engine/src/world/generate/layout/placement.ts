import { hash2D, mixSeeds } from "../../../core/rng.js";
import { CHUNK_SIZE } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

const PLACEMENT_SALT = 0x1a10;
const ANCHOR_JITTER_RADIUS =
  WORLD_GENERATION_TUNING.landmarks.anchorJitterRadius;
const ANCHOR_JITTER_SPAN = ANCHOR_JITTER_RADIUS * 2 + 1;

/** Stable seed for fixed-feature and landmark placement within the active layout. */
export function placementSeed(worldSeed: number, floor: number): number {
  return mixSeeds(worldSeed, floor, PLACEMENT_SALT);
}

export interface ChunkPlacement {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
}

/** Stable chunk-local anchor used to place landmarks without another layout pass. */
export function landmarkAnchor({
  worldSeed,
  floor,
  cx,
  cy,
}: ChunkPlacement): { x: number; y: number } {
  const seed = placementSeed(worldSeed, floor);
  const jx = hash2D(seed, cx, cy) % ANCHOR_JITTER_SPAN -
    ANCHOR_JITTER_RADIUS;
  const jy = hash2D(mixSeeds(seed, 0x0aa1), cx, cy) %
    ANCHOR_JITTER_SPAN - ANCHOR_JITTER_RADIUS;
  return { x: CHUNK_SIZE / 2 + jx, y: CHUNK_SIZE / 2 + jy };
}
