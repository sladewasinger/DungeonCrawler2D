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
    key: "terrain4-maze",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 1,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.OpenHalls]: {
    key: "terrain4-open-halls",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 3,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Ruins]: {
    key: "terrain4-ruins",
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
    key: "terrain4-pools",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 7,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
  [BIOME.Arena]: {
    key: "terrain4-arena",
    path: "assets/terrain4/terrain4-atlas.png",
    rows: 11,
    rowStart: 9,
    rowCount: TERRAIN4_ATLAS_ROWS_PER_SET,
  },
};

export function terrain4TileRoleIndex(role: Terrain4TileRole): number {
  return TERRAIN4_TILE_ROLES.indexOf(role);
}

export function terrain4FrameFor(role: Terrain4TileRole, row = 0): number {
  if (!Number.isInteger(row) || row < 0 || row >= TERRAIN4_ATLAS_ROWS_PER_SET) {
    throw new Error(`Terrain4 atlas row must be 0 or 1; received ${row}`);
  }
  return row * TERRAIN4_ATLAS_COLUMNS + terrain4TileRoleIndex(role);
}
