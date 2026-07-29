import { CHUNK_SIZE, TILE, type Chunk } from "@dc2d/engine";

const HEIGHT_SYMBOL_BY_VALUE = new Map<number, string>([
  [-1, "0"], [-0.5, "1"], [0, "2"], [0.5, "3"], [1, "4"], [2, "5"],
]);
const NORTH_PASSAGE_ROW = "...........VV................VV.";
const NORTH_WALL_ROW = "VVV........VV................VV.";
const WEST_VOID_ROW = "V............................VV.";
const OPEN_EAST_VOID_ROW = ".............................VV.";
const FINITE_OPEN_ROW = "................................";
const FINITE_WEST_CORE_ROW = ".B..............................";
const FINITE_EDGE_CORE_ROW = "B...............................";
const FINITE_MIDDLE_CORE_ROW = "......B.........................";

export const DEV_WORLD_TILE_ROWS = [
  NORTH_PASSAGE_ROW,
  NORTH_PASSAGE_ROW,
  NORTH_PASSAGE_ROW,
  NORTH_WALL_ROW,
  NORTH_WALL_ROW,
  NORTH_WALL_ROW,
  NORTH_WALL_ROW,
  "VVVVVVVVVVVVV................VV.",
  "VVVVVVVVVVVVVVVVV.......VVVVVVV.",
  "VVVVVVVVVVVVVVVVV.......VVVVVVV.",
  WEST_VOID_ROW,
  WEST_VOID_ROW,
  "V......V.....................VV.",
  ".......V.....................VVV",
  ".............................VVV",
  OPEN_EAST_VOID_ROW,
  ".S...........................VV.",
  WEST_VOID_ROW,
  "VVVVVVVVVV.........VVVVVVVVVVVV.",
  "VVVVVVVVVV........VVVVVVVVVVVVV.",
  ".....VVV..........VV.........VV.",
  ".....VVV..........VV.........VV.",
  ".....VVV.....................VV.",
  "........S....................VV.",
  "........S....................VV.",
  OPEN_EAST_VOID_ROW,
  OPEN_EAST_VOID_ROW,
  "..................VV.........VV.",
  "VVVVV...VVVVVVVVVVVVVVVVVVVVVVVV",
  "VVVVV...VVVVVVVVVVVVVVVVVVVVVVVV",
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
] as const;

export const FINITE_DEV_WORLD_TILE_ROWS = [
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_WEST_CORE_ROW,
  FINITE_WEST_CORE_ROW,
  FINITE_WEST_CORE_ROW,
  FINITE_WEST_CORE_ROW,
  ".BBBBBBBBBBB....................",
  "BBBBBBBBBBB.....................",
  FINITE_EDGE_CORE_ROW,
  FINITE_EDGE_CORE_ROW,
  FINITE_EDGE_CORE_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  ".S..............................",
  FINITE_OPEN_ROW,
  "BBBBBBBBBB......................",
  FINITE_MIDDLE_CORE_ROW,
  FINITE_MIDDLE_CORE_ROW,
  FINITE_MIDDLE_CORE_ROW,
  FINITE_OPEN_ROW,
  "........S.......................",
  "........S.......................",
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  FINITE_OPEN_ROW,
  "BBBB.....BBBBBBBBBBBBBBBBBBBBBBB",
  "BBBB.....BBBBBBBBBBBBBBBBBBBBBBB",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
] as const;

/** Exact pre-VOID finite heights for the screenshot regression chunk.
 * Symbols map in ascending order: 0=-1, 1=-0.5, 2=0, 3=0.5, 4=1, 5=2. */
export const FINITE_DEV_WORLD_HEIGHT_ROWS = [
  "22222222222442222222222222222442",
  "22222222222442222222222222222442",
  "22222222222442222222222222222442",
  "44422222222442222222222222222442",
  "45422222222442222222222222222442",
  "45422222222442222222222222222442",
  "45422222222442222222222222222442",
  "45444444444442222222222222222442",
  "45555555555544444222222244444442",
  "55555555555244444222222244444442",
  "54444444444222222222222222222442",
  "54444444444222222222222222222442",
  "54444444444222222222222222222442",
  "24444444444222222222222222222444",
  "22244444444222222222222222222444",
  "22244444444222222222222222222442",
  "23444444444222222222222222222442",
  "43444444444222222222222222222442",
  "55555555554222222224444444444442",
  "22222452220000000024444444444442",
  "22222452000000000024222222222442",
  "22222452000000000024222222222442",
  "22222422000000000022222222222442",
  "22222222102222222222222222222442",
  "22222222102222222222222222222442",
  "22222222222222222222222222222442",
  "22222222222222222222222222222442",
  "22222222000000000024222222222442",
  "44444222222222222224444444444444",
  "55554222455555555555555555555555",
  "55554444455555555555555555555555",
  "55555555555555555555555555555555",
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
  if (tile === TILE.Bedrock) return "B";
  return "?";
}

function heightSymbol(height: number | undefined): string {
  return HEIGHT_SYMBOL_BY_VALUE.get(height ?? Number.NaN) ?? "?";
}
