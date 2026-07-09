import { CHUNK_SIZE, TILE, ZONE, type TileType } from "../types";

/**
 * DEV SCAFFOLDING — a deterministic movement proving ground stamped
 * over chunks (0,0)–(1,1) on every floor, replacing generated terrain
 * there (heights blend back into the surrounding world across the
 * zone's outer tiles). Spawns prefer it so jumping, falling, and
 * cliffs can be tested immediately. Remove before v0.9.
 *
 * Contents (world tile coords):
 *  - Terraced hill at (14,14): 1-step rings, walk to the h5 summit
 *  - Staircase up to four h2 jump pillars with 2/3/4-tile gaps
 *    between them (jump across, or miss and fall to the floor)
 *  - Drop tower x40–55: h 2/4/6/8 bands — jump-climb the +2 steps or
 *    take the west staircase lane: real single-step staircases with
 *    landings between (every climb is one staircase OBJECT — no long
 *    tread ramps; the art can't represent multi-level ramps)
 *  - Chasm at y44–52: two h2 platforms with a 3-tile gap; fall in and
 *    exit via the ramp at the south end
 *  - Safe-room entrance kiosk at (53..55, 52..54), portal door (54,54)
 *
 * The sim adds example fixtures on top (items/hazards/enemies for each
 * of Epics 3–7) — see TEST_ZONE_* tables in game-server/src/sim.ts.
 */

export const TEST_ZONE_MIN_CHUNK = 0;
export const TEST_ZONE_MAX_CHUNK = 1;
const ZONE_TILES = (TEST_ZONE_MAX_CHUNK + 1) * CHUNK_SIZE; // 64
const EDGE_BLEND = 10; // outer tiles lerp back to generated terrain

/** Preferred dev spawn: flat ground central to the structures. */
export const TEST_SPAWN = { x: 28.5, y: 28.5 };

interface Sample {
  tile: TileType;
  h: number;
  zone: number;
}

function sample(wx: number, wy: number): Sample {
  let h = 0;
  let tile: TileType = TILE.Floor;
  let zone: number = ZONE.None;

  // Terraced hill: +1 per 2-tile ring, summit h5.
  const hillD = Math.max(Math.abs(wx - 14), Math.abs(wy - 14));
  if (hillD <= 10) h = Math.min(5, Math.ceil((10 - hillD) / 2));

  // Jump pillars, with a single-step staircase entry onto pillar 1
  // (stair h1 between the floor and the h2 top → one wedge object).
  if (wy >= 34 && wy <= 37) {
    if (wx === 13) {
      h = 1;
      tile = TILE.Stairs;
    } else if (
      (wx >= 14 && wx <= 17) || // pillar 1 (climb the staircase)
      (wx >= 20 && wx <= 23) || // gap 2
      (wx >= 27 && wx <= 30) || // gap 3
      (wx >= 35 && wx <= 38) // gap 4
    ) {
      h = 2;
    }
  }

  // Drop tower: bands rise +2 northward. The west lane (x40–41) climbs
  // the same +2 steps as real staircases with landings between — a
  // single-step stair row at each band boundary (wy 27/23/19/15), so
  // every climb renders as one staircase object, sample-map style.
  if (wx >= 40 && wx <= 55 && wy >= 12 && wy <= 27) {
    if (wx <= 41) {
      if ((27 - wy) % 4 === 0) {
        h = (27 - wy) / 2 + 1; // 1, 3, 5, 7 — the entry steps
        tile = TILE.Stairs;
      } else {
        h = 2 * (Math.floor((27 - wy) / 4) + 1); // 2, 4, 6, 8 landings
      }
    } else {
      h = 2 + 2 * Math.floor((27 - wy) / 4);
    }
  }

  // Chasm: two h2 platforms, 3-tile gap, exit ramp at the south end.
  if (wy >= 44 && wy <= 51 && ((wx >= 24 && wx <= 28) || (wx >= 32 && wx <= 38))) h = 2;
  if (wy === 52 && wx >= 29 && wx <= 31) h = 1;

  // Safe-room entrance kiosk on a flat pad: the portal door in the
  // south face leads to the region's instanced safe room (rooms.ts).
  if (wx >= 50 && wx <= 58 && wy >= 50 && wy <= 58) {
    h = 0;
    if (Math.abs(wx - 54) <= 1 && Math.abs(wy - 53) <= 1) tile = TILE.Wall;
    if (wx === 54 && wy === 54) tile = TILE.DoorSafeRoom;
  }

  return { tile, h, zone };
}

/**
 * Stamp the test zone over a chunk's generated data. Must run before
 * pocket sealing (the zone is all floor, so nothing gets sealed) and
 * after normal generation (it blends toward the pre-overlay heights).
 */
export function applyTestZone(
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
): void {
  if (
    cx < TEST_ZONE_MIN_CHUNK ||
    cx > TEST_ZONE_MAX_CHUNK ||
    cy < TEST_ZONE_MIN_CHUNK ||
    cy > TEST_ZONE_MAX_CHUNK
  ) {
    return;
  }
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wy = cy * CHUNK_SIZE + ly;
      const i = ly * CHUNK_SIZE + lx;
      const { tile, h, zone } = sample(wx, wy);
      const borderDist = Math.min(wx, wy, ZONE_TILES - 1 - wx, ZONE_TILES - 1 - wy);
      const blend = borderDist >= EDGE_BLEND ? 0 : 1 - borderDist / EDGE_BLEND;
      tiles[i] = tile;
      zones[i] = zone;
      height[i] = h * (1 - blend) + (height[i] ?? 0) * blend;
    }
  }
}
