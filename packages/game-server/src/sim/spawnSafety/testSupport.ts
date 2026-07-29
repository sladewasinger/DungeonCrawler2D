import { CHASM_DEATH_Z } from "@dc2d/engine";
import { spawnEnemy } from "../core/helpers.js";
import { resolveSpawnAnchor } from "../spawn/spawn.js";
import type { SimState } from "../state/state.js";

type Tile = { x: number; y: number };

/** Finds a walkable, non-sanctuary, non-chasm tile center near an anchor. */
export function openFloorNear(sim: Pick<SimState, "world">, anchor: Tile): Tile {
  for (let radius = 0; radius < 64; radius++) {
    const tile = openFloorInRing(sim, anchor, radius);
    if (tile) return { x: tile.x + 0.5, y: tile.y + 0.5 };
  }
  throw new Error(`no open floor near (${anchor.x}, ${anchor.y})`);
}

/** Parks slimes on every third valid tile around the authoritative spawn anchor. */
export function blanketSpawnNeighborhood(sim: SimState): Tile[] {
  const parked: Tile[] = [];
  for (const tile of gridAround(resolveSpawnAnchor(sim), 20, 3)) {
    if (!isOpenFloor(sim, tile)) continue;
    const enemy = spawnEnemy(sim, { defId: "slime", x: tile.x + 0.5, y: tile.y + 0.5 });
    parked.push({ x: enemy.body.x, y: enemy.body.y });
  }
  return parked;
}

function openFloorInRing(sim: Pick<SimState, "world">, anchor: Tile, radius: number): Tile | null {
  for (const tile of ringTiles(anchor, radius)) {
    if (isOpenFloor(sim, tile)) return tile;
  }
  return null;
}

function* ringTiles(anchor: Tile, radius: number): Generator<Tile> {
  for (let x = -radius; x <= radius; x++) yield { x: anchor.x + x, y: anchor.y - radius };
  for (let y = -radius + 1; y <= radius; y++) yield { x: anchor.x + radius, y: anchor.y + y };
  for (let x = radius - 1; x >= -radius; x--) yield { x: anchor.x + x, y: anchor.y + radius };
  for (let y = radius - 1; y > -radius; y--) yield { x: anchor.x - radius, y: anchor.y + y };
}

function* gridAround(anchor: Tile, radius: number, step: number): Generator<Tile> {
  for (let y = anchor.y - radius; y <= anchor.y + radius; y += step) {
    for (let x = anchor.x - radius; x <= anchor.x + radius; x += step) yield { x, y };
  }
}

function isOpenFloor(sim: Pick<SimState, "world">, tile: Tile): boolean {
  return sim.world.isWalkable(tile.x, tile.y) &&
    !sim.world.isSanctuary(tile.x, tile.y) &&
    sim.world.heightAt(tile.x, tile.y) > CHASM_DEATH_Z;
}
