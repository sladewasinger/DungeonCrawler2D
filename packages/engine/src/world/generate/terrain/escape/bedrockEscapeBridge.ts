import { BEDROCK_MIN_HEIGHT, TILE } from "../../../core/types.js";
import {
  planBedrockBridgeHeights,
  reconstructBedrockPath,
} from "./bedrockEscapePlan.js";
import {
  escapeCardinalNeighbors,
  escapeTileIsBlocked,
} from "./escapeGrid.js";

const UNVISITED = -2;
const PATH_START = -1;
const HEIGHT_EPSILON = 0.01;
export interface BedrockBridgeTerrain {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly featureTiles: Uint8Array;
  readonly size: number;
}

export interface BedrockEscapeBridge {
  readonly path: readonly number[];
  readonly heights: readonly number[];
}

interface BridgeSearch {
  readonly terrain: BedrockBridgeTerrain;
  readonly escapable: Uint8Array;
  readonly predecessor: Int32Array;
  readonly pocket: Int32Array;
  readonly queue: number[];
}

interface BridgeSeed {
  readonly cell: number;
  readonly pocket: number;
}

/** Finds the shortest Bedrock-only bridge between a trapped floor and an exit. */
export function findBedrockEscapeBridge(
  terrain: BedrockBridgeTerrain,
  escapable: Uint8Array,
): BedrockEscapeBridge | null {
  const search = createSearch(terrain, escapable);
  seedFrontier(search);
  for (let head = 0; head < search.queue.length; head++) {
    const current = search.queue[head];
    if (current === undefined) continue;
    const bridge = bridgeFrom(search, current);
    if (bridge) return bridge;
    extendFrontier(search, current);
  }
  return null;
}

export function carveBedrockEscapeBridge(
  terrain: BedrockBridgeTerrain,
  bridge: BedrockEscapeBridge,
): void {
  for (let index = 0; index < bridge.path.length; index++) {
    const cell = bridge.path[index];
    const height = bridge.heights[index];
    if (cell === undefined || height === undefined) continue;
    terrain.tiles[cell] = TILE.Floor;
    terrain.height[cell] = height;
  }
}

function createSearch(
  terrain: BedrockBridgeTerrain,
  escapable: Uint8Array,
): BridgeSearch {
  const predecessor = new Int32Array(terrain.tiles.length);
  const pocket = new Int32Array(terrain.tiles.length);
  predecessor.fill(UNVISITED);
  pocket.fill(UNVISITED);
  return { terrain, escapable, predecessor, pocket, queue: [] };
}

function seedFrontier(search: BridgeSearch): void {
  const seeds = bridgeSeeds(search).sort((a, b) =>
    (search.terrain.height[b.pocket] ?? 0) -
      (search.terrain.height[a.pocket] ?? 0) ||
    a.pocket - b.pocket ||
    a.cell - b.cell
  );
  for (const seed of seeds) {
    if (!isAvailableBedrock(search, seed.cell)) continue;
    search.predecessor[seed.cell] = PATH_START;
    search.pocket[seed.cell] = seed.pocket;
    search.queue.push(seed.cell);
  }
}

function bridgeSeeds(search: BridgeSearch): BridgeSeed[] {
  const seeds: BridgeSeed[] = [];
  for (let pocket = 0; pocket < search.terrain.tiles.length; pocket++) {
    appendPocketSeeds(search, seeds, pocket);
  }
  return seeds;
}

function appendPocketSeeds(
  search: BridgeSearch,
  seeds: BridgeSeed[],
  pocket: number,
): void {
  if (search.escapable[pocket] === 1 ||
      escapeTileIsBlocked(search.terrain.tiles[pocket])) return;
  for (const cell of escapeCardinalNeighbors(pocket, search.terrain.size)) {
    if (search.terrain.tiles[cell] !== TILE.Bedrock ||
        !isMinimumHeightBedrock(search, cell) ||
        search.terrain.featureTiles[cell] !== TILE.Floor) continue;
    seeds.push({ cell, pocket });
  }
}

function bridgeFrom(
  search: BridgeSearch,
  current: number,
): BedrockEscapeBridge | null {
  for (const exit of escapeCardinalNeighbors(current, search.terrain.size)) {
    if (search.escapable[exit] !== 1 ||
        escapeTileIsBlocked(search.terrain.tiles[exit])) continue;
    const path = reconstructBedrockPath(search.predecessor, current);
    const pocket = search.pocket[current];
    if (pocket === undefined || pocket < 0) continue;
    const heights = planBedrockBridgeHeights({
      terrain: search.terrain,
      pocket,
      path,
      exit,
    });
    if (heights) return { path, heights };
  }
  return null;
}

function extendFrontier(search: BridgeSearch, current: number): void {
  for (const next of escapeCardinalNeighbors(current, search.terrain.size)) {
    if (!isAvailableBedrock(search, next)) continue;
    search.predecessor[next] = current;
    search.pocket[next] = search.pocket[current] ?? UNVISITED;
    search.queue.push(next);
  }
}

function isAvailableBedrock(search: BridgeSearch, index: number): boolean {
  return search.predecessor[index] === UNVISITED &&
    search.terrain.tiles[index] === TILE.Bedrock &&
    isMinimumHeightBedrock(search, index) &&
    search.terrain.featureTiles[index] === TILE.Floor;
}

function isMinimumHeightBedrock(search: BridgeSearch, index: number): boolean {
  return (search.terrain.height[index] ?? 0) <=
    BEDROCK_MIN_HEIGHT + HEIGHT_EPSILON;
}
