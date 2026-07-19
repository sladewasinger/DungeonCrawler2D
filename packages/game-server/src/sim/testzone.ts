import { CHUNK_SIZE, TICK_RATE } from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "./helpers.js";
import { findWalkableNear } from "./spawn.js";
import type { SimState } from "./state.js";

/**
 * Deterministic dev-test-zone fixtures: one example of everything the
 * combat/effects/inventory systems support, findable right at spawn
 * (28.5, 28.5) so every mechanic is testable without hunting. Also the
 * e2e fixture set — positions stay stable across worldgen changes since
 * every authored anchor is snapped to the nearest real WALKABLE tile
 * (`snapToFloor`) rather than trusted literally: since walls are solid
 * (2026-07-19), an anchor that happens to land on wall rock would
 * otherwise spawn an unreachable, physically-impossible fixture.
 */

/**
 * Nearest walkable tile (integer coords) to an authored anchor, avoiding
 * any tile already `claim`ed this population pass — several anchors were
 * authored a single tile apart on what used to be a walkable wall-top
 * platform, so an unshared search would collapse them all onto the same
 * lone floor tile. Falls back to the floored anchor only if nothing
 * walkable turns up at all — that means the anchor needs re-authoring,
 * not a silent drop. Exported so tests can resolve a fixture's real,
 * post-snap location instead of asserting against the literal
 * (possibly-wall) anchor. Areas key by this integer tile directly.
 */
export function snapToFloorTile(
  sim: Pick<SimState, "world">,
  x: number,
  y: number,
  claimed: Set<string> = new Set(),
): { x: number; y: number } {
  const tile = findWalkableNear(sim, x, y, 16, claimed) ?? { x: Math.floor(x), y: Math.floor(y) };
  claimed.add(`${tile.x},${tile.y}`);
  return tile;
}

/** Same snap, centered for an entity body position. */
export function snapToFloor(
  sim: Pick<SimState, "world">,
  x: number,
  y: number,
  claimed?: Set<string>,
): { x: number; y: number } {
  const tile = snapToFloorTile(sim, x, y, claimed);
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

// The slime pit at (20..24, 42) is the e2e combat arena — the other
// enemy examples live in the west/north corners, outside aggro range
// of both the arena and the walking routes. The remote review cluster is
// intentionally mixed and compact: it is the normal-speed readability
// fixture for overlapping attack tells, projectiles, and particles.
const TEST_ZONE_ENEMIES: Array<{ def: string; x: number; y: number }> = [
  { def: "slime", x: 20.5, y: 42.5 },
  { def: "slime", x: 23.5, y: 42.5 },
  { def: "plant-creeper", x: 8.5, y: 36.5 },
  { def: "skeleton", x: 8.5, y: 14.5 },
  { def: "spitter", x: 12.5, y: 20.5 },
  { def: "plant-creeper", x: 3.5, y: 60.5 },
  { def: "skeleton", x: 2.5, y: 62.5 },
  { def: "spitter", x: 5.5, y: 61.5 },
  { def: "slime", x: 4.5, y: 63.5 },
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

export const TEST_ZONE_RESEED_TICKS = 2 * TICK_RATE;

/** Keep the dev hazard patches alive — areas decay, examples shouldn't.
 * `claimed` lets a caller share one occupancy set across a whole
 * population burst (see populateTestZoneChunk); standalone reseed calls
 * default to their own. */
export function seedTestZoneHazards(sim: SimState, claimed: Set<string> = new Set()): void {
  for (const hazard of TEST_ZONE_HAZARDS) {
    const { x, y } = snapToFloorTile(sim, hazard.x, hazard.y, claimed);
    if (sim.areas.defAt(x, y) === null) {
      sim.areas.spawn(hazard.def, x, y, hazard.radius);
    }
  }
}

/** Keep canonical pickup examples available across long dev/e2e sessions. */
export function seedTestZoneItems(sim: SimState, claimed: Set<string> = new Set()): void {
  for (const fixture of TEST_ZONE_ITEMS) {
    const { x, y } = snapToFloor(sim, fixture.x, fixture.y, claimed);
    const exists = [...sim.items.values()].some(
      (item) => item.defId === fixture.def && Math.hypot(item.body.x - x, item.body.y - y) < 0.25,
    );
    if (!exists) spawnItem(sim, fixture.def, x, y, fixture.qty ?? 1);
  }
}

/**
 * Fixed fixtures instead of random spawns for the chunks around the
 * proving ground. Returns true when (cx, cy) is a test-zone chunk.
 */
export function populateTestZoneChunk(sim: SimState, cx: number, cy: number): boolean {
  if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return false;
  const claimed = new Set<string>();
  spawnChunkFixtures(sim, cx, cy, claimed);
  if (cx === 0 && cy === 0) {
    sim.hazardsActive = true;
    seedTestZoneHazards(sim, claimed);
  }
  return true;
}

function spawnChunkFixtures(sim: SimState, cx: number, cy: number, claimed: Set<string>): void {
  const inChunk = (f: { x: number; y: number }) =>
    Math.floor(f.x / CHUNK_SIZE) === cx && Math.floor(f.y / CHUNK_SIZE) === cy;
  for (const f of TEST_ZONE_ENEMIES) {
    if (!inChunk(f)) continue;
    const { x, y } = snapToFloor(sim, f.x, f.y, claimed);
    spawnEnemy(sim, f.def, x, y);
  }
  for (const f of TEST_ZONE_ITEMS) {
    if (!inChunk(f)) continue;
    const { x, y } = snapToFloor(sim, f.x, f.y, claimed);
    spawnItem(sim, f.def, x, y, f.qty ?? 1);
  }
}
