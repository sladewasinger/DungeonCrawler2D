import { WALL_RISE } from "../../../../core/constants.js";
import {
  carveBedrockEscapeBridge,
  findBedrockEscapeBridge,
} from "./bedrockEscapeBridge.js";
import {
  applyHeightEscapeRepair,
  findHeightEscapeRepair,
} from "./heightEscapeRepair.js";
import {
  escapeCardinalNeighbors,
  escapeTileIsBlocked,
} from "./escapeGrid.js";

const HEIGHT_EPSILON = 0.01;

interface EscapeTerrain {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly corridorCarved: Uint8Array;
  readonly featureTiles: Uint8Array;
  readonly size: number;
}

interface EscapeTraversal { readonly terrain: EscapeTerrain; readonly reached: Uint8Array; readonly queue: number[]; }

/**
 * Removes directed height traps after wall heights are known. A player may
 * descend freely, but must be able to climb back toward a district-edge
 * corridor in one-tile jumps. Each trapped basin gets one lowered, feature-free
 * notch instead of being silently left as a one-way drop.
 */
export function polishTerrainEscapes(terrain: EscapeTerrain): void {
  for (let repairCount = 0; repairCount < terrain.tiles.length; repairCount++) {
    const escapable = findEscapableCells(terrain);
    const repair = findHeightEscapeRepair(
      terrain,
      escapable,
      escapeCardinalNeighbors,
    );
    if (repair) {
      applyHeightEscapeRepair(terrain, repair);
      continue;
    }
    const bridge = findBedrockEscapeBridge(terrain, escapable);
    if (!bridge) return;
    carveBedrockEscapeBridge(terrain, bridge);
  }
}

function findEscapableCells(terrain: EscapeTerrain): Uint8Array {
  const reached = new Uint8Array(terrain.tiles.length);
  const queue = districtExitSeeds(terrain);
  for (const index of queue) reached[index] = 1;
  for (let head = 0; head < queue.length; head++) {
    const destination = queue[head];
    if (destination !== undefined) {
      visitEscapePredecessors({ terrain, reached, queue }, destination);
    }
  }
  return reached;
}

function districtExitSeeds(terrain: EscapeTerrain): number[] {
  const seeds: number[] = [];
  for (let index = 0; index < terrain.tiles.length; index++) {
    if (!isBorder(index, terrain.size) ||
        terrain.corridorCarved[index] !== 1 ||
        escapeTileIsBlocked(terrain.tiles[index])) continue;
    seeds.push(index);
  }
  return seeds;
}

function visitEscapePredecessors(
  traversal: EscapeTraversal,
  destination: number,
): void {
  const { terrain, reached, queue } = traversal;
  for (const source of escapeCardinalNeighbors(destination, terrain.size)) {
    if (reached[source] === 1 || !canReach(terrain, source, destination)) {
      continue;
    }
    reached[source] = 1;
    queue.push(source);
  }
}

function canReach(
  terrain: EscapeTerrain,
  source: number,
  destination: number,
): boolean {
  if (escapeTileIsBlocked(terrain.tiles[source]) ||
      escapeTileIsBlocked(terrain.tiles[destination])) return false;
  return (terrain.height[destination] ?? 0) -
    (terrain.height[source] ?? 0) <= WALL_RISE + HEIGHT_EPSILON;
}

function isBorder(index: number, size: number): boolean {
  const x = index % size;
  const y = Math.floor(index / size);
  return x === 0 || y === 0 || x === size - 1 || y === size - 1;
}
