import { TILE, type Chunk } from "../../core/types.js";
import { CHASM_DEPTH } from "./height.js";
import { TOWER_MAX_RISE } from "../landmarks/tower.js";

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
  stats.firstViolation ||=
    `chunk ${chunk.cx},${chunk.cy} ${tileKind} ${index} has height ${height}`;
}

export function accumulateHeightBudget(
  stats: HeightBudgetStats,
  chunk: Chunk,
  includeStairs: boolean,
): void {
  for (let index = 0; index < chunk.tiles.length; index++) {
    accumulateTileHeight({ stats, chunk, index, includeStairs });
  }
}

function accumulateTileHeight({ stats, chunk, index, includeStairs }: { stats: HeightBudgetStats; chunk: Chunk; index: number; includeStairs: boolean }): void {
  const tile = chunk.tiles[index];
  const height = chunk.height[index] ?? 0;
  if (tile === TILE.Floor) return accumulateFloorHeight({ stats, height, chunk, index });
  if (includeStairs && tile === TILE.Stairs) recordHeight({ stats, height, chunk, index, tileKind: "stairs" });
}

function accumulateFloorHeight({ stats, height, chunk, index }: Omit<HeightRecord, "tileKind">): void {
  recordHeight({ stats, height, chunk, index, tileKind: "floor" });
  if (height === 0) stats.plainFloors++;
  else stats.deliberateFloors++;
}
