import { BIOME, type BiomeKind } from "@dc2d/engine";

/** Stable column order shared by every Terrain4 atlas. Do not reorder these IDs. */
export const TERRAIN4_TILE_ROLES = [
  "floor",
  "raised-floor",
  "south-face",
  "corner-face",
  "void",
  "stairs",
  "door",
  "brazier",
] as const;

export type Terrain4TileRole = (typeof TERRAIN4_TILE_ROLES)[number];

export const TERRAIN4_ATLAS_COLUMNS = TERRAIN4_TILE_ROLES.length;
export const TERRAIN4_ATLAS_ROWS_PER_SET = 2;
const BIOME_ATLAS_KEY = "terrain4-biomes";
const BIOME_ATLAS_PATH = "assets/terrain4/terrain4-atlas.png";
const CLIFF_ATLAS_KEY = "terrain4-cliffs";
const CLIFF_ATLAS_PATH = "assets/terrain4/terrain4-cliffs.png";

export interface Terrain4AtlasSet { readonly key: string; readonly path: string; /** Number of logical rows in the image. */ readonly rows: number; /** First logical row containing this set. */ readonly rowStart: number; readonly rowCount: number; }

/** A named crop registered on the loaded Phaser texture. */
export interface Terrain4AtlasFrame { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

export const TERRAIN4_CLIFF_ROLES = ["cliff-middle", "cliff-corner"] as const;
export type Terrain4CliffTileRole = (typeof TERRAIN4_CLIFF_ROLES)[number];

export interface Terrain4CliffAtlasSet { readonly key: string; readonly path: string; readonly columns: 2; readonly rows: number; readonly rowStart: number; readonly rowCount: number; }

/** The cliff sheet keeps a two-column role contract and two variants per biome. */
export const TERRAIN4_CLIFF_TILESETS: Readonly<Record<"debug" | BiomeKind, Terrain4CliffAtlasSet>> = {
  debug: { key: "terrain4-cliffs-debug", path: "assets/terrain4/cliffs-debug-atlas.png", columns: 2, rows: 1, rowStart: 0, rowCount: 1 },
  [BIOME.Maze]: cliffSet(2), [BIOME.OpenHalls]: cliffSet(4), [BIOME.Ruins]: cliffSet(6), [BIOME.Pillars]: cliffSet(8), [BIOME.Pools]: cliffSet(10), [BIOME.Arena]: cliffSet(12),
};

/**
 * The generated shared sheet contains a debug legend row followed by five
 * biome sets. Pillar Forest has its own generated sheet, but uses the exact
 * same two-row, eight-column contract. Keeping this metadata separate from
 * geometry lets art be replaced without touching the height-map planner.
 */
export const TERRAIN4_TILESETS: Readonly<Record<"debug" | BiomeKind, Terrain4AtlasSet>> = {
  debug: {
    key: "terrain4-debug",
    path: "assets/terrain4/debug-atlas.png",
    rows: TERRAIN4_ATLAS_ROWS_PER_SET,
    rowStart: 0,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Maze]: biomeSet(1), [BIOME.OpenHalls]: biomeSet(3), [BIOME.Ruins]: biomeSet(5),
  [BIOME.Pillars]: {
    key: "terrain4-pillars",
    path: "assets/terrain4/pillar-forest-atlas.png",
    rows: TERRAIN4_ATLAS_ROWS_PER_SET,
    rowStart: 0,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Pools]: biomeSet(7), [BIOME.Arena]: biomeSet(9),
};

export function terrain4TileRoleIndex(role: Terrain4TileRole): number {
  return TERRAIN4_TILE_ROLES.indexOf(role);
}

export function terrain4FrameFor(role: Terrain4TileRole, row?: number): number;
export function terrain4FrameFor(set: Terrain4AtlasSet, role: Terrain4TileRole, row?: number): number;
export function terrain4FrameFor(
  setOrRole: Terrain4AtlasSet | Terrain4TileRole,
  roleOrRow: Terrain4TileRole | number = 0,
  variant = 0,
): number {
  if (typeof setOrRole === "string") return frameAtRow(setOrRole, roleOrRow as number);
  return frameAtSet(setOrRole, roleOrRow as Terrain4TileRole, variant);
}

function frameAtRow(role: Terrain4TileRole, row: number): number {
  assertVariant(row);
  return row * TERRAIN4_ATLAS_COLUMNS + terrain4TileRoleIndex(role);
}

function frameAtSet(set: Terrain4AtlasSet, role: Terrain4TileRole, row: number): number {
  assertVariant(row);
  return (set.rowStart + row) * TERRAIN4_ATLAS_COLUMNS + terrain4TileRoleIndex(role);
}

/** Unique Phaser frame name for a role in one biome/debug atlas set. */
export function terrain4AtlasFrameName(
  set: Terrain4AtlasSet,
  role: Terrain4TileRole,
  variant = 0,
): string {
  assertVariant(variant);
  return `terrain4:${set.key}:${set.rowStart + variant}:${role}`;
}

/** Maps the stable logical grid to a crop in an atlas image of the given size. */
export function terrain4AtlasFrame(
  input: Terrain4AtlasFrameInput,
): Terrain4AtlasFrame {
  const { set, role, variant, image } = input;
  assertVariant(variant);
  if (!isValidImageSize(image)) {
    throw new Error("Terrain4 atlas image dimensions must be positive");
  }
  const width = image.width / TERRAIN4_ATLAS_COLUMNS;
  const height = image.height / set.rows;
  return {
    name: terrain4AtlasFrameName(set, role, variant),
    x: terrain4TileRoleIndex(role) * width,
    y: (set.rowStart + variant) * height,
    width,
    height,
  };
}

export interface Terrain4AtlasFrameInput { readonly set: Terrain4AtlasSet; readonly role: Terrain4TileRole; readonly variant: number; readonly image: ImageSize; }
export interface ImageSize { readonly width: number; readonly height: number; }

export function terrain4CliffAtlasFrameName(
  set: Terrain4CliffAtlasSet,
  role: Terrain4CliffTileRole,
  variant = 0,
): string {
  assertSetVariant(set, variant);
  return `terrain4-cliff:${set.key}:${set.rowStart + variant}:${role}`;
}

export function terrain4CliffAtlasFrame(
  input: Terrain4CliffAtlasFrameInput,
): Terrain4AtlasFrame {
  const { set, role, variant, image } = input;
  assertSetVariant(set, variant);
  if (!isValidImageSize(image)) {
    throw new Error("Terrain4 cliff atlas image dimensions must be positive");
  }
  const width = image.width / set.columns;
  const height = image.height / set.rows;
  return {
    name: terrain4CliffAtlasFrameName(set, role, variant),
    x: TERRAIN4_CLIFF_ROLES.indexOf(role) * width,
    y: (set.rowStart + variant) * height,
    width,
    height,
  };
}

export interface Terrain4CliffAtlasFrameInput { readonly set: Terrain4CliffAtlasSet; readonly role: Terrain4CliffTileRole; readonly variant: number; readonly image: ImageSize; }

function isValidImageSize(image: ImageSize): boolean {
  return Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

function cliffSet(rowStart: number): Terrain4CliffAtlasSet {
  return { key: CLIFF_ATLAS_KEY, path: CLIFF_ATLAS_PATH, columns: 2, rows: 14, rowStart, rowCount: 2 };
}

function biomeSet(rowStart: number): Terrain4AtlasSet {
  return { key: BIOME_ATLAS_KEY, path: BIOME_ATLAS_PATH, rows: 11, rowStart, rowCount: TERRAIN4_ATLAS_ROWS_PER_SET };
}

function assertSetVariant(set: Terrain4CliffAtlasSet, variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= set.rowCount) {
    throw new Error(`Terrain4 cliff atlas row must be below ${set.rowCount}; received ${variant}`);
  }
}

function assertVariant(variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= TERRAIN4_ATLAS_ROWS_PER_SET) {
    throw new Error(`Terrain4 atlas row must be 0 or 1; received ${variant}`);
  }
}
