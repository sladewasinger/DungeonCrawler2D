/** Derives population test positions from the current prepared finite floor. */
import { CHUNK_SIZE } from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";
import { spawnEnemyPack } from "../../population.js";
import { validEnemySpawn } from "../../populationPlacement.js";
import { isNearSpawnPopulationPosition } from "../nearSpawn.js";

interface PopulationTileOptions {
  readonly nearSpawnOnly?: boolean;
}

interface PopulationTileQuery {
  readonly sim: SimState;
  readonly options: PopulationTileOptions;
}

interface PopulationChunkQuery extends PopulationTileQuery {
  readonly cx: number;
  readonly cy: number;
}

interface PopulationCoordinateQuery extends PopulationTileQuery {
  readonly x: number;
  readonly y: number;
}

export function mostPopulatableChunk(
  sim: SimState,
  options: PopulationTileOptions = {},
): { cx: number; cy: number } {
  const bounds = sim.world.floorBounds;
  if (!bounds) throw new Error("Population fixture requires finite floor bounds");
  const ranked = finiteChunkCoordinates(bounds).map(({ cx, cy }) => ({
    cx, cy, count: validPopulationTileCount({ sim, cx, cy, options }),
  }));
  const best = ranked.reduce((current, candidate) =>
    candidate.count > current.count ? candidate : current);
  if (best.count <= 0) throw new Error("Population fixture has no valid chunk");
  return { cx: best.cx, cy: best.cy };
}

export function spawnMostPopulatablePack(
  sim: SimState,
  options: PopulationTileOptions = {},
): void {
  const chunk = mostPopulatableChunk(sim, options);
  spawnEnemyPack(sim, chunk.cx, chunk.cy);
}

export function findPopulationTile(
  sim: SimState,
  options: PopulationTileOptions = {},
): { x: number; y: number } {
  const chunk = mostPopulatableChunk(sim, options);
  for (let y = chunk.cy * CHUNK_SIZE; y < (chunk.cy + 1) * CHUNK_SIZE; y += 1) {
    for (let x = chunk.cx * CHUNK_SIZE; x < (chunk.cx + 1) * CHUNK_SIZE; x += 1) {
      if (isPopulationTile({ sim, x, y, options })) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error("Population fixture chunk has no valid tile");
}

function finiteChunkCoordinates(bounds: NonNullable<SimState["world"]["floorBounds"]>): Array<{ cx: number; cy: number }> {
  return Array.from({ length: bounds.maxChunkY - bounds.minChunkY + 1 }, (_, row) =>
    Array.from({ length: bounds.maxChunkX - bounds.minChunkX + 1 }, (_, column) => ({
      cx: bounds.minChunkX + column,
      cy: bounds.minChunkY + row,
    })),
  ).flat();
}

function validPopulationTileCount(input: PopulationChunkQuery): number {
  let count = 0;
  for (let y = input.cy * CHUNK_SIZE; y < (input.cy + 1) * CHUNK_SIZE; y += 1) {
    for (let x = input.cx * CHUNK_SIZE; x < (input.cx + 1) * CHUNK_SIZE; x += 1) {
      if (isPopulationTile({ ...input, x, y })) count += 1;
    }
  }
  return count;
}

function isPopulationTile(input: PopulationCoordinateQuery): boolean {
  if (!validEnemySpawn(input.sim, input.x, input.y)) return false;
  return !input.options.nearSpawnOnly || isNearSpawnPopulationPosition(
    input.sim,
    { x: input.x + 0.5, y: input.y + 0.5 },
  );
}
