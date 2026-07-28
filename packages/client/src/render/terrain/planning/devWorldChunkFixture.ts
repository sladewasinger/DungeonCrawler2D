import { CHUNK_SIZE, TILE, type Chunk } from "@dc2d/engine";

const NORTH_VOID_ROW = "VVVVVVVVVVVVVVVVVVVVVV...VVVVVVV";
const NORTH_ROOM_ROW = "VVVV............VVV........VVVVV";
const PIT_CORRIDOR_ROW = "VVVV......V.........VVV.....VVVV";
const SOUTH_VOID_ROW = "VVVVV.....VVVVVVVVVVVVVVVVVVVVVV";
const HEIGHT_SYMBOL_BY_VALUE = new Map<number, string>([
  [-1, "0"], [-0.5, "1"], [0, "2"], [0.5, "3"], [1, "4"], [2, "5"],
]);

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

export const FINITE_DEV_WORLD_TILE_ROWS = DEV_WORLD_TILE_ROWS.map((row) => row.replaceAll("V", "."));

/** Exact pre-VOID finite heights for the screenshot regression chunk.
 * Symbols map in ascending order: 0=-1, 1=-0.5, 2=0, 3=0.5, 4=1, 5=2. */
export const FINITE_DEV_WORLD_HEIGHT_ROWS = [
  "55555555555555555555542224555555",
  "55555555555555555555542224555555",
  "55555555555555555555542224555555",
  "55542222454222224552222222225555",
  "55542222424222224542002220025555",
  "55542222222222224542202220025555",
  "55542222222222224542202220025555",
  "55542222222222224542202220025555",
  "55542222444222224242202220025555",
  "55542222444222222222202220022222",
  "55542222442222222222222221122222",
  "55542222442222222222222222224444",
  "55542222442222222222444222225555",
  "55542222442222222222444244445555",
  "55542222442222222222422244445555",
  "55542222442222222222222244445555",
  "55542222442222222222222243345555",
  "55542222442222222222222222225555",
  "22242222242222222222242222222555",
  "22222222242000002222252001102555",
  "44442222442000001100252000002555",
  "55542222442000000000252000002555",
  "55542222222000000000252000002555",
  "55542222222000000000252000002555",
  "55542222222000000000252000002555",
  "55542222222000000000252000002555",
  "55542222222000000000252000002555",
  "55544222222000000000252000002555",
  "55554222222222222222252222222555",
  "55554222224555555555555555555555",
  "55554222224555555555555555555555",
  "55554222224555555555555555555555",
] as const;

export function chunkTileRows(chunk: Chunk): readonly string[] {
  return Array.from({ length: CHUNK_SIZE }, (_, y) =>
    Array.from({ length: CHUNK_SIZE }, (_, x) => tileSymbol(chunk.tiles[y * CHUNK_SIZE + x])).join(""));
}

export function chunkHeightRows(chunk: Chunk): readonly string[] {
  return Array.from({ length: CHUNK_SIZE }, (_, y) =>
    Array.from({ length: CHUNK_SIZE }, (_, x) => heightSymbol(chunk.height[y * CHUNK_SIZE + x])).join(""));
}

function tileSymbol(tile: number | undefined): string {
  if (tile === TILE.Floor) return ".";
  if (tile === TILE.Stairs) return "S";
  if (tile === TILE.Void) return "V";
  return "?";
}

function heightSymbol(height: number | undefined): string {
  return HEIGHT_SYMBOL_BY_VALUE.get(height ?? Number.NaN) ?? "?";
}
