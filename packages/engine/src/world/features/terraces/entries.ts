import { CORRIDOR_HALF_WIDTH, distToCorridor, type CorridorSegment } from "../../terrain.js";
import { TILE } from "../../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../../generate/scale.js";
import type { WorldChunkCoordinate } from "../platforms.js";
import { TERRACE_RISE } from "../terraces.js";

export interface TerraceRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface TerraceEntryInput {
  rect: TerraceRect;
  chunk: WorldChunkCoordinate;
  segs: CorridorSegment[];
  tiles: Uint8Array;
  height: Float32Array;
}

interface EntryEdge {
  cells: Array<[number, number]>;
  width: number;
  inside: readonly [number, number];
}

export function carveTerraceEntries(input: TerraceEntryInput): void {
  for (const edge of entryEdges(input.rect)) carveEntryEdge(input, edge);
}

function carveEntryEdge(input: TerraceEntryInput, edge: EntryEdge): void {
  let run: Array<[number, number]> = [];
  for (const cell of edge.cells) {
    if (isEntryCell(input, cell, edge.inside)) run.push(cell);
    else run = flushEntryRun(input, run, edge.width);
  }
  flushEntryRun(input, run, edge.width);
}

function flushEntryRun(input: TerraceEntryInput, run: Array<[number, number]>, width: number): Array<[number, number]> {
  const cells = run.slice(Math.floor((run.length - Math.min(width, run.length)) / 2), Math.floor((run.length + Math.min(width, run.length)) / 2));
  for (const [lx, ly] of cells) stampEntry(input, lx, ly);
  return [];
}

function stampEntry(input: TerraceEntryInput, lx: number, ly: number): void {
  const index = ly * CHUNK_SIZE + lx;
  input.tiles[index] = TILE.Stairs;
  input.height[index] = TERRACE_RISE / 2;
}

function isEntryCell(input: TerraceEntryInput, cell: [number, number], inside: readonly [number, number]): boolean {
  const [lx, ly] = cell;
  const [insideX, insideY] = inside;
  if (!isInChunk(lx, ly) || !isInChunk(lx + insideX, ly + insideY)) return false;
  return isCorridor(input, lx, ly) && isFloor(input.tiles, lx, ly) && isFloor(input.tiles, lx + insideX, ly + insideY);
}

function isInChunk(lx: number, ly: number): boolean {
  return lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
}

function isCorridor(input: TerraceEntryInput, lx: number, ly: number): boolean {
  const x = input.chunk.cx * CHUNK_SIZE + lx;
  const y = input.chunk.cy * CHUNK_SIZE + ly;
  return distToCorridor(input.segs, x, y) <= CORRIDOR_HALF_WIDTH;
}

function isFloor(tiles: Uint8Array, lx: number, ly: number): boolean {
  return tiles[ly * CHUNK_SIZE + lx] === TILE.Floor;
}

function entryEdges(rect: TerraceRect): EntryEdge[] {
  return [
    { cells: horizontalCells(rect), width: 2, inside: [0, -1] },
    { cells: verticalCells(rect, rect.x1 + 1), width: 1, inside: [-1, 0] },
    { cells: verticalCells(rect, rect.x0 - 1), width: 1, inside: [1, 0] },
  ];
}

function horizontalCells(rect: TerraceRect): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let lx = rect.x0 + 1; lx < rect.x1; lx++) cells.push([lx, rect.y1 + 1]);
  return cells;
}

function verticalCells(rect: TerraceRect, lx: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let ly = rect.y0 + 1; ly < rect.y1; ly++) cells.push([lx, ly]);
  return cells;
}
