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

export interface Terrain4AtlasSet {
  readonly key: string;
  readonly path: string;
  /** Number of logical rows in the image. The renderer samples a set's rows. */
  readonly rows: number;
  /** First logical row containing this set; useful for a shared biome sheet. */
  readonly rowStart: number;
  readonly rowCount: number;
}

/** A named crop registered on the loaded Phaser texture. */
export interface Terrain4AtlasFrame {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

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
  [BIOME.Maze]: {
    key: "terrain4-biomes",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 1,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.OpenHalls]: {
    key: "terrain4-biomes",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 3,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Ruins]: {
    key: "terrain4-biomes",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 5,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Pillars]: {
    key: "terrain4-pillars",
    path: "assets/terrain4/pillar-forest-atlas.png",
    rows: TERRAIN4_ATLAS_ROWS_PER_SET,
    rowStart: 0,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Pools]: {
    key: "terrain4-biomes",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 7,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Arena]: {
    key: "terrain4-biomes",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 9,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
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
  set: Terrain4AtlasSet,
  role: Terrain4TileRole,
  variant: number,
  imageWidth: number,
  imageHeight: number,
): Terrain4AtlasFrame {
  assertVariant(variant);
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error("Terrain4 atlas image dimensions must be positive");
  }
  const width = imageWidth / TERRAIN4_ATLAS_COLUMNS;
  const height = imageHeight / set.rows;
  return {
    name: terrain4AtlasFrameName(set, role, variant),
    x: terrain4TileRoleIndex(role) * width,
    y: (set.rowStart + variant) * height,
    width,
    height,
  };
}

function assertVariant(variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= TERRAIN4_ATLAS_ROWS_PER_SET) {
    throw new Error(`Terrain4 atlas row must be 0 or 1; received ${variant}`);
  }
}
