import { CHUNK_SIZE, TILE, type Chunk } from "@dc2d/engine";

const NORTH_VOID_ROW = "VVVVVVVVVVVVVVVVVVVVVV...VVVVVVV";
const NORTH_ROOM_ROW = "VVVV............VVV........VVVVV";
const PIT_CORRIDOR_ROW = "VVVV......V.........VVV.....VVVV";
const SOUTH_VOID_ROW = "VVVVV.....VVVVVVVVVVVVVVVVVVVVVV";

export const DEV_WORLD_TILE_ROWS = [
  NORTH_VOID_ROW,
  NORTH_VOID_ROW,
  NORTH_VOID_ROW,
  NORTH_VOID_ROW,
  "VVVV....VVV.....VVVV.......VVVVV",
  NORTH_ROOM_ROW,
  NORTH_ROOM_ROW,
  NORTH_ROOM_ROW,
  "VVVV....VVV.....VVV........VVVVV",
  "VVVV....VVV................VVVVV",
  "VVVV....VV...............SS.....",
  "VVVV....VV.........VVV....VVVVVV",
  "VVVV....VV.........VVVV...VVVVVV",
  "VVVV....VV..........VVV.....VVVV",
  "VVVV....VV..........V.......VVVV",
  "VVVV....VV..................VVVV",
  "VVVV....VV...............SS.VVVV",
  "VVVV....VV.............VV..VVVVV",
  "VVVV.....V.........VVVVVV..VVVVV",
  ".........VV........VVVV..SS.VVVV",
  "VVVV....VVV.....SS..VVV.....VVVV",
  "VVVV....VVV.........VVV.....VVVV",
  PIT_CORRIDOR_ROW,
  PIT_CORRIDOR_ROW,
  PIT_CORRIDOR_ROW,
  PIT_CORRIDOR_ROW,
  PIT_CORRIDOR_ROW,
  "VVVVV.....V.........VVV.....VVVV",
  SOUTH_VOID_ROW,
  SOUTH_VOID_ROW,
  SOUTH_VOID_ROW,
  SOUTH_VOID_ROW,
] as const;

export function chunkTileRows(chunk: Chunk): readonly string[] {
  return Array.from({ length: CHUNK_SIZE }, (_, y) =>
    Array.from({ length: CHUNK_SIZE }, (_, x) => tileSymbol(chunk.tiles[y * CHUNK_SIZE + x])).join(""));
}

function tileSymbol(tile: number | undefined): string {
  if (tile === TILE.Floor) return ".";
  if (tile === TILE.Stairs) return "S";
  if (tile === TILE.Void) return "V";
  return "?";
}
