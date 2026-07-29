import { WALL_RISE } from "../../../../core/constants.js";
import { TILE, TOPOLOGY } from "../../../core/types.js";
import { escapeTileIsBlocked } from "./escapeGrid.js";

const HEIGHT_EPSILON = 0.01;

interface HeightRepairTerrain {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly featureTiles: Uint8Array;
  readonly size: number;
}

export interface HeightEscapeRepair {
  readonly pocket: number;
  readonly barrier: number;
  readonly priority: number;
  readonly lowering: number;
}

interface RepairSearch {
  readonly terrain: HeightRepairTerrain;
  readonly escapable: Uint8Array;
}

export function findHeightEscapeRepair(
  terrain: HeightRepairTerrain,
  escapable: Uint8Array,
  neighbors: (index: number, size: number) => number[],
): HeightEscapeRepair | null {
  const search = { terrain, escapable };
  let best: HeightEscapeRepair | null = null;
  for (let pocket = 0; pocket < terrain.tiles.length; pocket++) {
    const candidate = bestPocketRepair(search, pocket, neighbors);
    if (candidate && repairPrecedes(candidate, best)) best = candidate;
  }
  return best;
}

export function applyHeightEscapeRepair(
  terrain: HeightRepairTerrain,
  repair: HeightEscapeRepair,
): void {
  terrain.tiles[repair.barrier] = TILE.Floor;
  terrain.height[repair.barrier] =
    (terrain.height[repair.pocket] ?? 0) + WALL_RISE;
}

function escapeRepair(
  search: RepairSearch,
  pocket: number,
  barrier: number,
): HeightEscapeRepair | null {
  const { terrain, escapable } = search;
  if (escapable[barrier] !== 1 ||
      terrain.featureTiles[barrier] !== TILE.Floor ||
      !isRepairableSurface(terrain.tiles[barrier])) return null;
  const lowering = (terrain.height[barrier] ?? 0) -
    (terrain.height[pocket] ?? 0) - WALL_RISE;
  if (lowering <= HEIGHT_EPSILON) return null;
  const priority = terrain.tiles[barrier] === TOPOLOGY.Uncarved ? 0 : 1;
  return { pocket, barrier, priority, lowering };
}

function bestPocketRepair(
  search: RepairSearch,
  pocket: number,
  neighbors: (index: number, size: number) => number[],
): HeightEscapeRepair | null {
  if (search.escapable[pocket] === 1 ||
      escapeTileIsBlocked(search.terrain.tiles[pocket])) return null;
  let best: HeightEscapeRepair | null = null;
  for (const barrier of neighbors(pocket, search.terrain.size)) {
    const candidate = escapeRepair(search, pocket, barrier);
    if (candidate && repairPrecedes(candidate, best)) best = candidate;
  }
  return best;
}

function isRepairableSurface(tile: number | undefined): boolean {
  return tile === TILE.Floor || tile === TOPOLOGY.Uncarved;
}

function repairPrecedes(
  candidate: HeightEscapeRepair,
  current: HeightEscapeRepair | null,
): boolean {
  if (!current || candidate.priority !== current.priority) {
    return !current || candidate.priority < current.priority;
  }
  if (Math.abs(candidate.lowering - current.lowering) > HEIGHT_EPSILON) {
    return candidate.lowering < current.lowering;
  }
  return candidate.barrier < current.barrier;
}
