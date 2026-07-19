// Floor variant selection: hash-picked per tile so every client draws the identical
// world (VISUAL_DIRECTION's determinism contract). Mostly plain stone — cracked/skull
// decor is sparse and concentrated near walls/edges, not scattered through open rooms
// (defect: over-picking decor read as noisy rubble). Sanctuary zones get their own tile.
import { hash2D, ZONE, type ZoneType } from "@dc2d/engine";

/** floor_1/floor_5 read as plain stone; the rest carry a visible crack or skull decal. */
const PLAIN_VARIANTS = [1, 5] as const;
const DECOR_VARIANTS = [2, 3, 4, 6, 7, 8] as const;
const ROLL_SALT = 0x9f10;
const VARIANT_SALT = 0x4c21;

/** Decor chance out of 100 — higher right against a wall/chasm rim than in an open room center. */
const EDGE_DECOR_CHANCE = 32;
const OPEN_DECOR_CHANCE = 8;

export type EdgeNeighbor = (dx: number, dy: number) => boolean;

/** True when any orthogonal neighbor counts as an edge (wall or chasm rim). */
export function isNearEdge(isEdge: EdgeNeighbor): boolean {
  return isEdge(-1, 0) || isEdge(1, 0) || isEdge(0, -1) || isEdge(0, 1);
}

function pick(pool: readonly [number, ...number[]], wx: number, wy: number): number {
  return pool[hash2D(VARIANT_SALT, wx, wy) % pool.length] ?? pool[0];
}

/** The floor sprite frame for a world tile: floor_sanctuary in sanctuary zones, else a hash-picked floor_1..8. */
export function floorFrame(wx: number, wy: number, zone: ZoneType, nearEdge: boolean): string {
  if (zone === ZONE.Sanctuary) return "floor_sanctuary";
  const decorChance = nearEdge ? EDGE_DECOR_CHANCE : OPEN_DECOR_CHANCE;
  const roll = hash2D(ROLL_SALT, wx, wy) % 100;
  const pool = roll < decorChance ? DECOR_VARIANTS : PLAIN_VARIANTS;
  return `floor_${pick(pool, wx, wy)}`;
}
