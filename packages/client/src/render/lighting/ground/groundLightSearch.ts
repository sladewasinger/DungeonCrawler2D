import { TERRAIN } from "@dc2d/engine";
import {
  canGroundLightCrossStep,
  hasClearGroundLightLine,
  isGroundLightSurface,
} from "./groundLightVisibility.js";
import { groundLightMaximumCells } from "./groundLightBudget.js";
import { groundLightStrength } from "./groundLightCurve.js";
import type {
  GroundLightCell,
  GroundLightSource,
  GroundLightTile,
  GroundLightWorld,
} from "./groundLightTypes.js";

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

interface GroundLightSearch {
  readonly world: GroundLightWorld;
  readonly source: GroundLightSource;
  readonly origin: GroundLightTile;
  readonly maximumCells: number;
  readonly cells: GroundLightCell[];
  readonly visited: Set<string>;
  readonly queue: GroundLightTile[];
}

/** Builds a LOS/height-aware floor-cell reveal for either a player or a torch. */
export function groundLightCells(
  world: GroundLightWorld,
  source: GroundLightSource,
): readonly GroundLightCell[] {
  const search = createSearch(world, source);
  if (!isGroundLightSurface(world, search.origin)) return [];
  populateCells(search);
  return search.cells;
}

function createSearch(
  world: GroundLightWorld,
  source: GroundLightSource,
): GroundLightSearch {
  const origin = { x: Math.floor(source.x), y: Math.floor(source.y) };
  return {
    world,
    source,
    origin,
    maximumCells: groundLightMaximumCells(source.radiusTiles),
    cells: [],
    visited: new Set([tileKey(origin)]),
    queue: [origin],
  };
}

function populateCells(search: GroundLightSearch): void {
  for (let index = 0; index < search.queue.length; index += 1) {
    if (search.cells.length >= search.maximumCells) return;
    const tile = search.queue[index];
    if (!tile) continue;
    appendCell(search, tile);
    visitNeighbors(search, tile);
  }
}

function appendCell(search: GroundLightSearch, tile: GroundLightTile): void {
  if (search.world.terrainAt(tile.x, tile.y) !== TERRAIN.Floor) return;
  const distance = distanceToSource(search, tile);
  search.cells.push({
    tileX: tile.x,
    tileY: tile.y,
    strength: groundLightStrength(distance, search.source.radiusTiles),
    groundHeight: search.world.groundAt(tile.x + 0.5, tile.y + 0.5),
  });
}

function visitNeighbors(search: GroundLightSearch, tile: GroundLightTile): void {
  for (const [dx, dy] of ORTHOGONAL) {
    const next = { x: tile.x + dx, y: tile.y + dy };
    if (canVisit(search, tile, next)) search.queue.push(next);
  }
}

function canVisit(
  search: GroundLightSearch,
  from: GroundLightTile,
  tile: GroundLightTile,
): boolean {
  if (search.visited.has(tileKey(tile))) return false;
  search.visited.add(tileKey(tile));
  return distanceToSource(search, tile) <= search.source.radiusTiles + 1e-6 &&
    canGroundLightCrossStep(search.world, from, tile) &&
    hasClearGroundLightLine(search.world, search.origin, tile);
}

function distanceToSource(
  search: GroundLightSearch,
  tile: GroundLightTile,
): number {
  return Math.hypot(tile.x + 0.5 - search.source.x, tile.y + 0.5 - search.source.y);
}

function tileKey(tile: GroundLightTile): string {
  return `${tile.x},${tile.y}`;
}
