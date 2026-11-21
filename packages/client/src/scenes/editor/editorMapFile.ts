import { TILE, type FloorBounds, type TileType } from "@dc2d/engine";
import type { EditorCell, EditorTerrainWorld } from "./EditorTerrainWorld.js";

interface SerializedEditorCell {
  readonly x: number; readonly y: number; readonly tile: TileType;
  readonly height: number; readonly fixture?: EditorCell["fixture"];
}

interface SerializedEditorMap {
  readonly version: 1; readonly worldSeed: number; readonly floor: number;
  readonly bounds: FloorBounds; readonly cells: readonly SerializedEditorCell[];
}

export function serializeEditorMap(world: EditorTerrainWorld, cells: ReadonlyMap<string, EditorCell>): string {
  const data: SerializedEditorMap = {
    version: 1, worldSeed: world.worldSeed, floor: world.floor, bounds: world.floorBounds,
    cells: [...cells.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, cell]) => serializedCell(key, cell)),
  };
  return JSON.stringify(data, null, 2);
}

export function parseEditorMap(serialized: string): SerializedEditorMap {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error("Editor map file is not valid JSON"); }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cells)) {
    throw new Error("Editor map file version is unsupported");
  }
  return value as unknown as SerializedEditorMap;
}

export function validateEditorMap(data: SerializedEditorMap, world: EditorTerrainWorld): void {
  if (data.worldSeed !== world.worldSeed || data.floor !== world.floor ||
      !sameBounds(data.bounds, world.floorBounds) || data.cells.length > 10000) {
    throw new Error("Editor map file does not match this finite floor");
  }
  for (const cell of data.cells) validateEditorCell(cell, world);
}

export function editorMapCells(data: SerializedEditorMap): readonly [string, EditorCell][] {
  return data.cells.map((cell) => [
    `${cell.x},${cell.y}`,
    { tile: cell.tile, height: cell.height, ...(cell.fixture ? { fixture: cell.fixture } : {}) },
  ]);
}

function serializedCell(key: string, cell: EditorCell): SerializedEditorCell {
  const [x, y] = key.split(",").map(Number);
  if (x === undefined || y === undefined) throw new Error("Editor cell key is invalid");
  return { x, y, tile: cell.tile, height: cell.height, ...(cell.fixture ? { fixture: cell.fixture } : {}) };
}

function validateEditorCell(cell: SerializedEditorCell, world: EditorTerrainWorld): void {
  if (!validEditorPosition(cell, world) || !validEditorHeight(cell) || !validEditorTile(cell)) {
    throw new Error("Editor map file contains an invalid cell");
  }
  if (cell.fixture && !validEditorFixture(cell.fixture)) throw new Error("Editor map file contains an invalid fixture");
}

function validEditorPosition(cell: SerializedEditorCell, world: EditorTerrainWorld): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.y) && world.contains(cell);
}

function validEditorHeight(cell: SerializedEditorCell): boolean {
  return Number.isFinite(cell.height) && cell.height >= 0;
}

function validEditorTile(cell: SerializedEditorCell): boolean {
  return Object.values(TILE).includes(cell.tile);
}

function validEditorFixture(fixture: NonNullable<SerializedEditorCell["fixture"]>): boolean {
  return fixture === "safe" || fixture === "spawn" || fixture === "arena" || fixture === "feature";
}

function sameBounds(left: FloorBounds, right: FloorBounds): boolean {
  return ["minX", "minY", "width", "height", "maxX", "maxY", "minChunkX", "minChunkY", "maxChunkX", "maxChunkY"]
    .every((key) => left[key as keyof FloorBounds] === right[key as keyof FloorBounds]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
