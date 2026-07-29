import { CHASM_DEATH_Z } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { SPAWN_CLEARANCE_RADIUS } from "./constants.js";
import { insideGracedClearance } from "./clearance.js";

const RELOCATE_SEARCH_RADIUS = SPAWN_CLEARANCE_RADIUS + 10;

interface RelocationSearch {
  sim: SimState;
  from: { x: number; y: number };
  centers: ReadonlyArray<{ x: number; y: number }>;
  claimed: ReadonlySet<string>;
}

type Tile = { x: number; y: number };

/** Finds the nearest walkable tile outside every active spawn-clearance radius. */
export function findRelocationTile(search: RelocationSearch): Tile | null {
  const origin = { x: Math.floor(search.from.x), y: Math.floor(search.from.y) };
  for (let radius = 1; radius <= RELOCATE_SEARCH_RADIUS; radius++) {
    const tile = findTileInRing(search, origin, radius);
    if (tile) return tile;
  }
  return null;
}

function findTileInRing(search: RelocationSearch, origin: Tile, radius: number): Tile | null {
  for (const tile of ringTiles(origin, radius)) {
    if (isRelocationTile(search, tile)) return tile;
  }
  return null;
}

function* ringTiles(origin: Tile, radius: number): Generator<Tile> {
  for (let x = -radius; x <= radius; x++) yield { x: origin.x + x, y: origin.y - radius };
  for (let y = -radius + 1; y <= radius; y++) yield { x: origin.x + radius, y: origin.y + y };
  for (let x = radius - 1; x >= -radius; x--) yield { x: origin.x + x, y: origin.y + radius };
  for (let y = radius - 1; y > -radius; y--) yield { x: origin.x - radius, y: origin.y + y };
}

function isRelocationTile({ sim, centers, claimed }: RelocationSearch, tile: Tile): boolean {
  if (claimed.has(tileKey(tile))) return false;
  if (insideGracedClearance(centers, tile.x + 0.5, tile.y + 0.5)) return false;
  return sim.world.isWalkable(tile.x, tile.y) &&
    !sim.world.isSanctuary(tile.x, tile.y) &&
    sim.world.heightAt(tile.x, tile.y) > CHASM_DEATH_Z;
}

function tileKey({ x, y }: Tile): string {
  return `${x},${y}`;
}
