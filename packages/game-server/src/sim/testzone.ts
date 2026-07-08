import { CHUNK_SIZE, TICK_RATE } from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "./helpers";
import type { SimState } from "./state";

/**
 * Deterministic dev-test-zone fixtures: one example of everything the
 * Epic 3–7 systems introduced, findable right at spawn (28.5, 28.5) so
 * every mechanic is testable without hunting (see ROADMAP per-epic
 * "in-game examples" bullets). Also e2e fixtures — keep positions stable.
 */

// The slime pit at (20..24, 42) is the e2e combat arena — the other
// enemy examples live in the west/north corners, outside aggro range
// of both the arena and the walking routes.
const TEST_ZONE_ENEMIES: Array<{ def: string; x: number; y: number }> = [
  { def: "slime", x: 20.5, y: 42.5 },
  { def: "slime", x: 23.5, y: 42.5 },
  { def: "plant-creeper", x: 8.5, y: 36.5 },
  { def: "skeleton", x: 8.5, y: 14.5 },
  { def: "spitter", x: 12.5, y: 20.5 },
];

/** Weapons, ingredients, throwables, and consumables on the ground at spawn. */
const TEST_ZONE_ITEMS: Array<{ def: string; x: number; y: number; qty?: number }> = [
  { def: "sword", x: 30.5, y: 27.5 },
  { def: "hammer", x: 31.5, y: 28.5 },
  { def: "knife", x: 30.5, y: 29.5 },
  { def: "torch", x: 27.5, y: 26.5 },
  { def: "vodka-bottle", x: 28.5, y: 26.5 },
  { def: "water-flask", x: 29.5, y: 26.5 },
  { def: "bandage", x: 26.5, y: 28.5, qty: 2 },
  { def: "rag", x: 26.5, y: 29.5, qty: 2 },
  { def: "stick", x: 27.5, y: 30.5 },
  { def: "raw-meat", x: 28.5, y: 30.5 },
];

/** Standing hazards near spawn; reseeded when they burn/decay away. */
const TEST_ZONE_HAZARDS: Array<{ def: string; x: number; y: number; radius: number }> = [
  { def: "area-fire", x: 34, y: 24, radius: 1 },
  { def: "area-poison", x: 18, y: 33, radius: 1 },
  { def: "area-oil", x: 36, y: 31, radius: 1 },
  { def: "area-wet", x: 31, y: 32, radius: 1 },
];

export const HAZARD_RESEED_TICKS = 5 * TICK_RATE;

/** Keep the dev hazard patches alive — areas decay, examples shouldn't. */
export function seedTestZoneHazards(sim: SimState): void {
  for (const hazard of TEST_ZONE_HAZARDS) {
    if (sim.areas.defAt(hazard.x, hazard.y) === null) {
      sim.areas.spawn(hazard.def, hazard.x, hazard.y, hazard.radius);
    }
  }
}

/**
 * Fixed fixtures instead of random spawns for the chunks around the
 * proving ground. Returns true when (cx, cy) is a test-zone chunk.
 */
export function populateTestZoneChunk(sim: SimState, cx: number, cy: number): boolean {
  if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return false;
  const inChunk = (f: { x: number; y: number }) =>
    Math.floor(f.x / CHUNK_SIZE) === cx && Math.floor(f.y / CHUNK_SIZE) === cy;
  for (const f of TEST_ZONE_ENEMIES) if (inChunk(f)) spawnEnemy(sim, f.def, f.x, f.y);
  for (const f of TEST_ZONE_ITEMS) if (inChunk(f)) spawnItem(sim, f.def, f.x, f.y, f.qty ?? 1);
  if (cx === 0 && cy === 0) {
    sim.hazardsActive = true;
    seedTestZoneHazards(sim);
  }
  return true;
}
