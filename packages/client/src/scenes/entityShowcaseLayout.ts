// Shared world coordinates for the gallery's entity showcase row and wall-occlusion
// duo — both the camera presets (galleryCameraPositions.ts) and the showcase builder
// (entityShowcase.ts) read these so the camera always frames what's actually there.

/** Monster-cycling row + running/jumping player, laid out east of the "rooms" cluster. */
export const SHOWCASE_ROW = { baseX: 31, baseY: 50 } as const;

/** Tile spacing between consecutive monsters in the showcase row (entityShowcase.ts, vfxShowcase.ts). */
export const SHOWCASE_ROW_SPACING_TILES = 2;

/** World position of the showcase row's Nth monster slot — shared so vfx demo ticks land on real monsters. */
export function showcaseMonsterSlot(index: number): { x: number; y: number } {
  return { x: SHOWCASE_ROW.baseX + index * SHOWCASE_ROW_SPACING_TILES, y: SHOWCASE_ROW.baseY };
}

/** Bodies on opposite sides of a clean ten-cell wall run centered near (-42,-44). */
export const OCCLUSION_DUO = { northX: -42.5, northY: -44.05, southX: -42.5, southY: -41.5 } as const;

/** Shared cadence for the showcase skeleton's demo hp dips — entityShowcase.ts drives the hp bar/hit-flash off it, vfxShowcase.ts times its floating damage numbers to match. */
export const DEMO_HIT_TICK_MS = 900;
const DEMO_SKELETON_MAX_HP = 10;
const DEMO_HIT_TICKS_PER_CYCLE = 4;
const DEMO_HIT_DAMAGE = 2;

/** The showcase skeleton's hp at `nowMs`: dips by DEMO_HIT_DAMAGE each tick, then resets — a real, driving hit-flash + hp-bar demo instead of a static value. */
export function demoSkeletonHp(nowMs: number): number {
  const tickIndex = Math.floor(nowMs / DEMO_HIT_TICK_MS) % DEMO_HIT_TICKS_PER_CYCLE;
  return DEMO_SKELETON_MAX_HP - tickIndex * DEMO_HIT_DAMAGE;
}
