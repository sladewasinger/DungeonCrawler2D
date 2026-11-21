import { TILE, type Chunk } from "../../../core/types.js";
import { CHASM_DEPTH } from "../height.js";
import { TOWER_MAX_RISE } from "../../landmarks/tower.js";

export interface HeightBudgetStats {
  plainFloors: number;
  deliberateFloors: number;
  violations: number;
  firstViolation: string;
}

export function createHeightBudgetStats(): HeightBudgetStats {
  return {
    plainFloors: 0,
    deliberateFloors: 0,
    violations: 0,
    firstViolation: "",
  };
}

interface HeightRecord {
  stats: HeightBudgetStats;
  height: number;
  chunk: Chunk;
  index: number;
  tileKind: "floor" | "stairs";
}

function recordHeight({ stats, height, chunk, index, tileKind }: HeightRecord): void {
  if (height >= CHASM_DEPTH && height <= TOWER_MAX_RISE) return;
  stats.violations++;
  stats.firstViolation ||= `chunk ${chunk.cx},${chunk.cy} ${tileKind} ${index} has height ${height}`;
}

export function accumulateHeightBudget(stats: HeightBudgetStats, chunk: Chunk, includeStairs: boolean): void {
  for (let index = 0; index < chunk.tiles.length; index++) {
    accumulateTileHeight({ stats, chunk, index, includeStairs });
  }
}

function accumulateTileHeight(input: { stats: HeightBudgetStats; chunk: Chunk; index: number; includeStairs: boolean }): void {
  const tile = input.chunk.tiles[input.index];
  const height = input.chunk.height[input.index] ?? 0;
  if (tile === TILE.Floor) return accumulateFloorHeight({ stats: input.stats, height, chunk: input.chunk, index: input.index });
  if (input.includeStairs && tile === TILE.Stairs) recordHeight({ stats: input.stats, height, chunk: input.chunk, index: input.index, tileKind: "stairs" });
}

function accumulateFloorHeight(input: Omit<HeightRecord, "tileKind">): void {
  recordHeight({ ...input, tileKind: "floor" });
  if (input.height === 0) input.stats.plainFloors++;
  else input.stats.deliberateFloors++;
}
