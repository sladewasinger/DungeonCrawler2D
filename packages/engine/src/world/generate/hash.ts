// Deterministic hashing for the room-and-corridor generator: one seed derived
// from (worldSeed, floor), then per-node hashes keyed by a rect's own bounds
// so no salt needs threading through the BSP recursion (a leaf's bounds are
// already a pure function of the split sequence that produced it).

import { hash2D, mixSeeds } from "../../core/rng.js";
import type { Rect } from "./types.js";

const VARIANT_SALT = 0xa2c4;

export function architectSeed(worldSeed: number, floor: number): number {
  return mixSeeds(worldSeed, floor, VARIANT_SALT);
}

/** Per-chunk seed for everything that must vary chunk-to-chunk (BSP split, room flavor, corridor width, height). */
export function chunkSeed(seed: number, cx: number, cy: number): number {
  return mixSeeds(seed, cx, cy);
}

/** Hash keyed by a rect's own corners plus a per-purpose salt (pure, order-stable). */
export function rectHash(seed: number, rect: Rect, salt: number): number {
  const a = rect.x0 * 64 + rect.y0;
  const b = rect.x1 * 64 + rect.y1;
  return hash2D(mixSeeds(seed, salt), a, b);
}
