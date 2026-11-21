import { BIOME, type BiomeKind } from "@dc2d/engine";

const GOBLIN_FLOOR_ROLE = "territory-goblin-floor" as const;
const SPIDER_FLOOR_ROLE = "territory-spider-floor" as const;
const GAOL_FLOOR_ROLE = "territory-gaol-floor" as const;
const GOBLIN_WALL_ROLE = "territory-goblin-wall" as const;
const SPIDER_WALL_ROLE = "territory-spider-wall" as const;
const GAOL_WALL_ROLE = "territory-gaol-wall" as const;
const FLOOR_ROLE = "floor" as const;
const BEDROCK_ROLE = "bedrock" as const;
const SOUTH_FACE_ROLE = "south-face" as const;

/** Stable role IDs shared by every Terrain atlas. Do not remove or rename used roles. */
export const TERRAIN_TILE_ROLES = [
  FLOOR_ROLE,
  BEDROCK_ROLE,
  "raised-floor",
  SOUTH_FACE_ROLE,
  "void-wall-face",
  "void",
  "stairs",
  "stair-wall-face",
  "door",
  "brazier",
  GOBLIN_FLOOR_ROLE, SPIDER_FLOOR_ROLE, GAOL_FLOOR_ROLE,
  GOBLIN_WALL_ROLE, SPIDER_WALL_ROLE, GAOL_WALL_ROLE,
] as const;

export type TerrainTileRole = (typeof TERRAIN_TILE_ROLES)[number];

const TERRITORY_FLOOR_ROLES: readonly TerrainTileRole[] = [
  GOBLIN_FLOOR_ROLE, SPIDER_FLOOR_ROLE, GAOL_FLOOR_ROLE,
];

const TERRITORY_WALL_ROLES: readonly TerrainTileRole[] = [
  GOBLIN_WALL_ROLE, SPIDER_WALL_ROLE, GAOL_WALL_ROLE,
];

/** Maps territory ownership to the three authored floor texture variants. */
export function territoryFloorRole(territory: number | null | undefined): TerrainTileRole {
  if (territory === null || territory === undefined || territory < 0) return FLOOR_ROLE;
  return TERRITORY_FLOOR_ROLES[territory % TERRITORY_FLOOR_ROLES.length] ?? FLOOR_ROLE;
}

/** Maps territory ownership to the matching vertical wall texture variant. */
export function territoryWallRole(territory: number | null | undefined): TerrainTileRole {
  if (territory === null || territory === undefined || territory < 0) return SOUTH_FACE_ROLE;
  return TERRITORY_WALL_ROLES[territory % TERRITORY_WALL_ROLES.length] ?? SOUTH_FACE_ROLE;
}

interface TerrainAtlasSlot { readonly row: number; readonly column: number; }

/** Column zero is reserved for non-functional row labels in the debug atlas. */
const TERRAIN_ATLAS_LAYOUT: Readonly<Record<TerrainTileRole, TerrainAtlasSlot>> = {
  floor: { row: 0, column: 1 },
  // The compact authored atlas shares its dark column-3 art with goblin floors.
  [BEDROCK_ROLE]: { row: 0, column: 3 },
  "raised-floor": { row: 0, column: 2 },
  "south-face": { row: 1, column: 1 },
  "void-wall-face": { row: 4, column: 2 },
  stairs: { row: 2, column: 1 },
  "stair-wall-face": { row: 2, column: 2 },
  door: { row: 3, column: 1 },
  brazier: { row: 3, column: 2 },
  void: { row: 4, column: 1 },
  [GOBLIN_FLOOR_ROLE]: { row: 0, column: 3 },
  [SPIDER_FLOOR_ROLE]: { row: 0, column: 4 },
  [GAOL_FLOOR_ROLE]: { row: 0, column: 5 },
  [GOBLIN_WALL_ROLE]: { row: 1, column: 3 },
  [SPIDER_WALL_ROLE]: { row: 1, column: 4 },
  [GAOL_WALL_ROLE]: { row: 1, column: 5 },
};

export const TERRAIN_ATLAS_COLUMNS = 9;
export const TERRAIN_ATLAS_ROWS_PER_SET = 5;
const TERRAIN_ATLAS_VARIANTS_PER_SET = 1;
const SHARED_ATLAS_KEY = "shared-atlas";
const SHARED_ATLAS_PATH = "assets/terrain/shared-atlas.png";

export interface TerrainAtlasSet { readonly key: string; readonly path: string; /** Number of logical rows in the image. */ readonly rows: number; /** First logical row containing this set. */ readonly rowStart: number; readonly rowCount: number; }

/** A named crop registered on the loaded Phaser texture. */
export interface TerrainAtlasFrame { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

/**
 * Non-debug rendering intentionally uses one shared atlas and the same logical
 * slots for every biome. Keeping this metadata separate from geometry lets the
 * art source change without touching the height-map planner.
 */
export const TERRAIN_TILESETS: Readonly<Record<"debug" | BiomeKind, TerrainAtlasSet>> = {
  debug: {
    key: "debug-atlas",
    path: "assets/terrain/debug-atlas.png",
    rows: TERRAIN_ATLAS_ROWS_PER_SET,
    rowStart: 0,
    rowCount: TERRAIN_ATLAS_VARIANTS_PER_SET,
  },
  [BIOME.Maze]: sharedSet(), [BIOME.OpenHalls]: sharedSet(), [BIOME.Ruins]: sharedSet(),
  [BIOME.Pillars]: sharedSet(), [BIOME.Pools]: sharedSet(), [BIOME.Arena]: sharedSet(),
};

export function terrainTileRoleIndex(role: TerrainTileRole): number {
  return TERRAIN_ATLAS_LAYOUT[role].column;
}

export function terrainFrameFor(role: TerrainTileRole, row?: number): number;
export function terrainFrameFor(set: TerrainAtlasSet, role: TerrainTileRole, row?: number): number;
export function terrainFrameFor(
  setOrRole: TerrainAtlasSet | TerrainTileRole,
  roleOrRow: TerrainTileRole | number = 0,
  variant = 0,
): number {
  if (typeof setOrRole === "string") return frameAtRow(setOrRole, roleOrRow as number);
  return frameAtSet(setOrRole, roleOrRow as TerrainTileRole, variant);
}

function frameAtRow(role: TerrainTileRole, row: number): number {
  assertVariant(row);
  return atlasFrameIndex(TERRAIN_ATLAS_LAYOUT[role], 0);
}

function frameAtSet(set: TerrainAtlasSet, role: TerrainTileRole, row: number): number {
  assertVariant(row);
  return atlasFrameIndex(TERRAIN_ATLAS_LAYOUT[role], set.rowStart);
}

/** Unique Phaser frame name for a role in one biome/debug atlas set. */
export function terrainAtlasFrameName(
  set: TerrainAtlasSet,
  role: TerrainTileRole,
  variant = 0,
): string {
  assertSetVariant(set, variant);
  return `terrain:${set.key}:${set.rowStart}:${role}`;
}

/** Maps the stable logical grid to a crop in an atlas image of the given size. */
export function terrainAtlasFrame(
  input: TerrainAtlasFrameInput,
): TerrainAtlasFrame {
  const { set, role, variant, image } = input;
  assertSetVariant(set, variant);
  if (!isValidImageSize(image)) {
    throw new Error("Terrain atlas image dimensions must be positive");
  }
  const width = image.width / TERRAIN_ATLAS_COLUMNS;
  const height = image.height / set.rows;
  const slot = TERRAIN_ATLAS_LAYOUT[role];
  return {
    name: terrainAtlasFrameName(set, role, variant),
    x: slot.column * width,
    y: (set.rowStart + slot.row) * height,
    width,
    height,
  };
}

export interface TerrainAtlasFrameInput { readonly set: TerrainAtlasSet; readonly role: TerrainTileRole; readonly variant: number; readonly image: ImageSize; }
export interface ImageSize { readonly width: number; readonly height: number; }

function isValidImageSize(image: ImageSize): boolean {
  return Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

function sharedSet(): TerrainAtlasSet {
  return { key: SHARED_ATLAS_KEY, path: SHARED_ATLAS_PATH, rows: TERRAIN_ATLAS_ROWS_PER_SET, rowStart: 0, rowCount: TERRAIN_ATLAS_VARIANTS_PER_SET };
}

function atlasFrameIndex(slot: TerrainAtlasSlot, rowStart: number): number {
  return (rowStart + slot.row) * TERRAIN_ATLAS_COLUMNS + slot.column;
}

function assertSetVariant(set: TerrainAtlasSet, variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= set.rowCount) {
    throw new Error(`Terrain atlas row must be below ${set.rowCount}; received ${variant}`);
  }
}

function assertVariant(variant: number): void {
  if (!Number.isInteger(variant) || variant < 0 || variant >= TERRAIN_ATLAS_VARIANTS_PER_SET) {
    throw new Error(`Terrain atlas row must be 0; received ${variant}`);
  }
}
