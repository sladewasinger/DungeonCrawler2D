import { hash2D } from "../../core/rng.js";
import { forEachCell, localIndex } from "./finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint } from "./finiteFloorTypes.js";
import { territoryProfile, type TerritoryId } from "./territories/territoryCatalog.js";

const DISTRICT_CELL_SIZE = 16;
const CARDINAL = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;

interface DistrictGrid {
  readonly width: number;
  readonly height: number;
  readonly owners: Int8Array;
}

/** Round-robin flood growth keeps every biome contiguous while producing irregular borders. */
export function assignContiguousTerritories(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly territoryRoster: readonly TerritoryId[];
}): void {
  const grid = createDistrictGrid(input.bounds);
  const frontiers = seedFrontiers({ ...input, biomeCount: input.territoryRoster.length, grid });
  growDistricts({ ...input, biomeCount: input.territoryRoster.length, grid, frontiers });
  writeTerritories(input, grid);
}

function createDistrictGrid(bounds: FloorBounds): DistrictGrid {
  const width = Math.ceil(bounds.width / DISTRICT_CELL_SIZE);
  const height = Math.ceil(bounds.height / DISTRICT_CELL_SIZE);
  return { width, height, owners: new Int8Array(width * height).fill(-1) };
}

function seedFrontiers(input: {
  readonly seed: number;
  readonly biomeCount: number;
  readonly grid: DistrictGrid;
}): FloorPoint[][] {
  return Array.from({ length: input.biomeCount }, (_, biome) => {
    const seed = districtSeed({ grid: input.grid, seed: input.seed, biome, count: input.biomeCount });
    input.grid.owners[gridIndex(input.grid, seed)] = biome;
    return [seed];
  });
}

function districtSeed(input: { readonly grid: DistrictGrid; readonly seed: number; readonly biome: number; readonly count: number }): FloorPoint {
  const columns = Math.ceil(Math.sqrt(input.count));
  const rows = Math.ceil(input.count / columns);
  const column = input.biome % columns;
  const row = Math.floor(input.biome / columns);
  const cellWidth = Math.floor(input.grid.width / columns);
  const cellHeight = Math.floor(input.grid.height / rows);
  const jitterX = hash2D(input.seed, input.biome, 11) % Math.max(1, Math.floor(cellWidth / 2));
  const jitterY = hash2D(input.seed, input.biome, 29) % Math.max(1, Math.floor(cellHeight / 2));
  return {
    x: Math.min(input.grid.width - 1, column * cellWidth + Math.floor(cellWidth / 4) + jitterX),
    y: Math.min(input.grid.height - 1, row * cellHeight + Math.floor(cellHeight / 4) + jitterY),
  };
}

function growDistricts(input: {
  readonly seed: number;
  readonly biomeCount: number;
  readonly grid: DistrictGrid;
  readonly frontiers: FloorPoint[][];
}): void {
  const cursors = new Uint32Array(input.biomeCount);
  let remaining = input.grid.owners.reduce((count, owner) => count + (owner < 0 ? 1 : 0), 0);
  while (remaining > 0) {
    let claimed = 0;
    for (let biome = 0; biome < input.biomeCount; biome++) {
      claimed += expandDistrict({ ...input, cursors, biome });
    }
    if (claimed === 0) throw new Error("Biome district growth stalled");
    remaining -= claimed;
  }
}

function expandDistrict(input: {
  readonly seed: number;
  readonly grid: DistrictGrid;
  readonly frontiers: FloorPoint[][];
  readonly cursors: Uint32Array;
  readonly biome: number;
}): number {
  const frontier = input.frontiers[input.biome];
  if (!frontier) return 0;
  const next = nextDistrictCell(input, frontier);
  if (!next) return 0;
  input.grid.owners[gridIndex(input.grid, next)] = input.biome;
  frontier.push(next);
  return 1;
}

function nextDistrictCell(input: Parameters<typeof expandDistrict>[0], frontier: FloorPoint[]): FloorPoint | null {
  while ((input.cursors[input.biome] ?? 0) < frontier.length) {
    const cursor = input.cursors[input.biome] ?? 0;
    const point = frontier[cursor];
    if (!point) { input.cursors[input.biome] = cursor + 1; continue; }
    const candidates = orderedNeighbors(input.seed, point, input.biome)
      .filter((next) => unclaimed(input.grid, next));
    const next = candidates[0];
    if (next) return next;
    input.cursors[input.biome] = cursor + 1;
  }
  return null;
}

function orderedNeighbors(seed: number, point: FloorPoint, biome: number): FloorPoint[] {
  return CARDINAL
    .map((direction) => ({ x: point.x + direction.x, y: point.y + direction.y }))
    .sort((a, b) => hash2D(seed + biome, a.x, a.y) - hash2D(seed + biome, b.x, b.y));
}

function unclaimed(grid: DistrictGrid, point: FloorPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height
    && grid.owners[gridIndex(grid, point)] === -1;
}

function writeTerritories(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly territoryRoster: readonly TerritoryId[];
}, grid: DistrictGrid): void {
  forEachCell(input.bounds, (x, y, index) => {
    const gx = Math.floor((x - input.bounds.minX) / DISTRICT_CELL_SIZE);
    const gy = Math.floor((y - input.bounds.minY) / DISTRICT_CELL_SIZE);
    const territory = grid.owners[gridIndex(grid, { x: gx, y: gy })] ?? 0;
    const territoryId = input.territoryRoster[territory] ?? input.territoryRoster[0];
    input.buffers.territory[index] = territory;
    input.buffers.biome[index] = territoryId ? territoryProfile(territoryId).materialIndex : 0;
  });
}

function gridIndex(grid: DistrictGrid, point: FloorPoint): number {
  return point.y * grid.width + point.x;
}

export function roomBelongsToOneTerritory(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}): boolean {
  const territory = input.buffers.territory[localIndex({ bounds: input.bounds, x: input.x0, y: input.y0 })];
  for (let y = input.y0; y <= input.y1; y++) {
    for (let x = input.x0; x <= input.x1; x++) {
      if (input.buffers.territory[localIndex({ bounds: input.bounds, x, y })] !== territory) return false;
    }
  }
  return true;
}
