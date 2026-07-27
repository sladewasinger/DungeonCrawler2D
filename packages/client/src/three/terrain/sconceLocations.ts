import { CHASM_DEATH_Z, TILE, type World } from "@dc2d/engine";
import type { ViewDistance } from "./view/viewDistance.js";

const SCONCE_CELL_SIZE = 12;

interface TerrainCell {
  readonly x: number;
  readonly z: number;
}

const inside = (location: TerrainCell, origin: TerrainCell, radius: ViewDistance): boolean =>
  location.x >= origin.x - radius && location.x <= origin.x + radius &&
  location.z >= origin.z - radius && location.z <= origin.z + radius;

const isSconceLocation = (world: World, x: number, z: number): boolean =>
  !world.isWalkable(x, z) && world.tileAt(x, z) !== TILE.Void && world.heightAt(x, z) > CHASM_DEATH_Z;

const findSconceLocation = (world: World, cellX: number, cellZ: number): TerrainCell | null => {
  const start = Math.abs(cellX * 31 + cellZ * 17) % (SCONCE_CELL_SIZE ** 2);
  for (let index = 0; index < SCONCE_CELL_SIZE ** 2; index += 1) {
    const offset = (start + index) % (SCONCE_CELL_SIZE ** 2);
    const x = cellX * SCONCE_CELL_SIZE + (offset % SCONCE_CELL_SIZE);
    const z = cellZ * SCONCE_CELL_SIZE + Math.floor(offset / SCONCE_CELL_SIZE);
    if (isSconceLocation(world, x, z)) return { x, z };
  }
  return null;
};

const nearbySconceCells = (origin: TerrainCell, radius: ViewDistance): TerrainCell[] => {
  const startX = Math.floor((origin.x - radius) / SCONCE_CELL_SIZE);
  const startZ = Math.floor((origin.z - radius) / SCONCE_CELL_SIZE);
  const endX = Math.floor((origin.x + radius) / SCONCE_CELL_SIZE);
  const endZ = Math.floor((origin.z + radius) / SCONCE_CELL_SIZE);
  const cells: TerrainCell[] = [];
  for (let z = startZ; z <= endZ; z += 1) for (let x = startX; x <= endX; x += 1) cells.push({ x, z });
  return cells;
};

export const visibleSconceLocations = (world: World, origin: TerrainCell, radius: ViewDistance): TerrainCell[] =>
  nearbySconceCells(origin, radius)
    .map(({ x, z }) => findSconceLocation(world, x, z))
    .filter((location): location is TerrainCell => location !== null && inside(location, origin, radius))
    .sort((a, b) => Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z));
