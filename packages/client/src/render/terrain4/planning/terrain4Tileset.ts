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
export const TERRAIN4_ATLAS_ROWS_PER_SET = 1;
const SHARED_ATLAS_KEY = "shared-atlas";
const SHARED_ATLAS_PATH = "assets/terrain/shared-atlas.png";

export interface Terrain4AtlasSet { readonly key: string; readonly path: string; /** Number of logical rows in the image. */ readonly rows: number; /** First logical row containing this set. */ readonly rowStart: number; readonly rowCount: number; }

/** A named crop registered on the loaded Phaser texture. */
export interface Terrain4AtlasFrame { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

/**
 * Non-debug rendering intentionally uses one shared copy of the labeled debug
 * sheet for every biome. Keeping this metadata separate from geometry lets the
 * art source change without touching the height-map planner.
 */
export const TERRAIN4_TILESETS: Readonly<Record<"debug" | BiomeKind, Terrain4AtlasSet>> = {
  debug: {
    key: "debug-atlas",
    path: "assets/terrain/debug-atlas.png",
    rows: TERRAIN4_ATLAS_ROWS_PER_SET,
    rowStart: 0,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Maze]: sharedSet(), [BIOME.OpenHalls]: sharedSet(), [BIOME.Ruins]: sharedSet(),
  [BIOME.Pillars]: sharedSet(), [BIOME.Pools]: sharedSet(), [BIOME.Arena]: sharedSet(),
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
  assertSetVariant(set, variant);
  return `terrain4:${set.key}:${set.rowStart + variant}:${role}`;
}

/** Maps the stable logical grid to a crop in an atlas image of the given size. */
export function terrain4AtlasFrame(
  input: Terrain4AtlasFrameInput,
): Terrain4AtlasFrame {
  const { set, role, variant, image } = input;
  assertSetVariant(set, variant);
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

function isValidImageSize(image: ImageSize): boolean {
  return Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

function sharedSet(): Terrain4AtlasSet {
  return { key: SHARED_ATLAS_KEY, path: SHARED_ATLAS_PATH, rows: TERRAIN4_ATLAS_ROWS_PER_SET, rowStart: 0, rowCount: TERRAIN4_ATLAS_ROWS_PER_SET };
}

function assertSetVariant(set: Terrain4AtlasSet, variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= set.rowCount) {
    throw new Error(`Terrain4 atlas row must be below ${set.rowCount}; received ${variant}`);
  }
}

function assertVariant(variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= TERRAIN4_ATLAS_ROWS_PER_SET) {
    throw new Error(`Terrain4 atlas row must be 0; received ${variant}`);
  }
}
