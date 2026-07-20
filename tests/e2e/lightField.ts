// Deterministic, Node-side recomputation of the client's own baked tile lighting
// (packages/client/src/render/terrain/tileLight.ts) — the "light-state API" the torch
// e2e spec asserts brightening through (documented choice, see torch.test.ts). Pure and
// Phaser-free on both sides (World is @dc2d/engine; computeLightField only imports
// @dc2d/engine + sibling pure render/lighting modules), so it runs directly in the test
// process without a browser round-trip, and — because docs/ENGINEERING_STANDARDS.md
// requires determinism ("identical (worldSeed, floor, chunkCoord) => byte-identical
// chunk geometry") — reconstructing the exact same World here from the exact same seed
// the e2e game-server boots with is guaranteed to match what the live client rendered,
// not merely approximate it.
import { hashString, World } from "@dc2d/engine";
import { computeLightField, type DynamicLightSeed } from "../../packages/client/src/render/terrain/tileLight.js";
import { FLOOR, WORLD_SEED_TEXT } from "./env.js";

const HALF_REGION = 6;

/** A fresh World for the e2e seed/floor — construction is cheap (chunks generate lazily
 * on first read), so specs can call this per-assertion without sharing mutable state. */
export function e2eWorld(): World {
  return new World(hashString(WORLD_SEED_TEXT), FLOOR);
}

/**
 * 0 (fully ambient-dark) .. 1 (full torch-white) brightness at one tile, optionally with
 * extra dynamic light sources seeded in (e.g. a torch that just landed there).
 *
 * Reads only the tint's RED channel, not an (R+G+B) average — deliberately.
 * tileLight.ts's LEVEL_TINTS blends a level-dependent WARMTH (redder, less green/blue)
 * on top of a level-dependent brightness curve; WARM_R is exactly 1.0, so the red
 * channel's value (`255 * levelCurve(level)`) is the one channel warmth cancels out of
 * entirely — the pure brightness signal. An (R+G+B)/3 average is NOT monotonic in
 * level once a tile is already near-saturated (b≈1): pushing level higher still shifts
 * warmth up, which trades green/blue down for a *warmer*, not brighter, look — that
 * silently reads as "darker" to a naive average even though the tile is now the
 * closest one to the new light. Verified live against this exact confound (a landing
 * tile already lit to ~level 9-10 by nearby world torches read as *dimmer* on
 * (R+G+B)/3 once a level-14 torch seed was added, despite being strictly more lit).
 */
export function tileBrightness(world: World, x: number, y: number, dynamicSources: DynamicLightSeed[] = []): number {
  const x0 = Math.floor(x) - HALF_REGION;
  const y0 = Math.floor(y) - HALF_REGION;
  const field = computeLightField(world, x0, y0, HALF_REGION * 2, dynamicSources);
  const tint = field.tintAt(Math.floor(x), Math.floor(y));
  const r = (tint >> 16) & 0xff;
  return r / 255;
}

/** Brightness lookup (see tileBrightness's doc comment) as a reusable closure over one
 * shared computeLightField call — for scanning many tiles around the same center without
 * recomputing the BFS flood once per tile (tileBrightness's own convenience, single-point
 * form does exactly that, which gets expensive over a whole neighborhood scan). */
export function brightnessField(
  world: World,
  centerX: number,
  centerY: number,
  halfWindow: number,
  dynamicSources: DynamicLightSeed[] = [],
): (x: number, y: number) => number {
  const x0 = Math.floor(centerX) - halfWindow;
  const y0 = Math.floor(centerY) - halfWindow;
  const field = computeLightField(world, x0, y0, halfWindow * 2, dynamicSources);
  return (x, y) => ((field.tintAt(Math.floor(x), Math.floor(y)) >> 16) & 0xff) / 255;
}
