import {
  BEDROCK_MIN_HEIGHT,
  TILE,
  TOPOLOGY,
} from "../../core/types.js";

const CARDINAL_OFFSETS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const SURROUNDING_OFFSETS = [
  [-1, -1], [0, -1], [1, -1], [-1, 0],
  [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;

interface ComponentSearch {
  readonly source: Uint8Array;
  readonly height: Float32Array;
  readonly visited: Uint8Array;
  readonly size: number;
  readonly start: number;
}

interface BedrockSearch extends Omit<ComponentSearch, "start"> {
  readonly target: Uint8Array;
}

interface NeighborRequest {
  readonly index: number;
  readonly dx: number;
  readonly dy: number;
  readonly size: number;
}

/**
 * Bedrock begins only at absolute z2. Within that tier, a thick structural
 * wall is one collision/material shape: if any cell has the generator's full
 * surrounded core, promote its same-height cardinal component. Lower borders
 * and coreless islands stay ordinary jumpable wall caps.
 */
export function markBedrockStructures(
  tiles: Uint8Array,
  height: Float32Array,
  size: number,
): void {
  const source = tiles.slice();
  const visited = new Uint8Array(source.length);
  const search = { target: tiles, source, height, visited, size };
  for (let index = 0; index < source.length; index++) {
    markBedrockStructureAt(search, index);
  }
}

/**
 * Resolves the finite-mode topology plane into its runtime materials before
 * final platform and reachability polish.
 */
export function classifyFiniteWallStructures(
  tiles: Uint8Array,
  height: Float32Array,
  size: number,
): void {
  markBedrockStructures(tiles, height, size);
  for (let index = 0; index < tiles.length; index++) {
    if (tiles[index] === TOPOLOGY.Uncarved) tiles[index] = TILE.Floor;
  }
}

function markBedrockStructureAt(
  search: BedrockSearch,
  index: number,
): void {
  if (search.source[index] !== TOPOLOGY.Uncarved ||
      search.visited[index] === 1) return;
  if ((search.height[index] ?? 0) < BEDROCK_MIN_HEIGHT) {
    search.visited[index] = 1;
    return;
  }
  const component = collectWallComponent({ ...search, start: index });
  if (!component.some((cell) =>
    isWallCore(search.source, cell, search.size)
  )) return;
  for (const cell of component) search.target[cell] = TILE.Bedrock;
}

function collectWallComponent(
  search: ComponentSearch,
): number[] {
  const component: number[] = [];
  const pending = [search.start];
  search.visited[search.start] = 1;
  while (pending.length > 0) {
    const index = pending.pop();
    if (index === undefined) continue;
    component.push(index);
    appendWallNeighbors(search, index, pending);
  }
  return component;
}

function appendWallNeighbors(
  search: ComponentSearch,
  index: number,
  pending: number[],
): void {
  for (const [dx, dy] of CARDINAL_OFFSETS) {
    const neighbor = neighborIndex({ index, dx, dy, size: search.size });
    if (neighbor === null || search.visited[neighbor] === 1 ||
        search.source[neighbor] !== TOPOLOGY.Uncarved ||
        (search.height[neighbor] ?? 0) < BEDROCK_MIN_HEIGHT) continue;
    search.visited[neighbor] = 1;
    pending.push(neighbor);
  }
}

function isWallCore(
  source: Uint8Array,
  index: number,
  size: number,
): boolean {
  return SURROUNDING_OFFSETS.every(([dx, dy]) => {
    const neighbor = neighborIndex({ index, dx, dy, size });
    return neighbor === null || source[neighbor] === TOPOLOGY.Uncarved;
  });
}

function neighborIndex(
  { index, dx, dy, size }: NeighborRequest,
): number | null {
  const x = index % size + dx;
  const y = Math.floor(index / size) + dy;
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return y * size + x;
}
