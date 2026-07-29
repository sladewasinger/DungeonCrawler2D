// Core world data shapes: tile/zone vocabularies and the read-only view movement and AI depend on.

/** Runtime and generated chunks share one 32×32 tile grid. */
export const CHUNK_SIZE = 32;

export const TILE = {
  Floor: 0,
  Stairs: 2,
  /** Safe-room door to your personal stretch room. */
  DoorPersonal: 3,
  /** Safe-room door to your party's common room. */
  DoorParty: 4,
  /** Inside a stretch room: door back to where you came from. */
  DoorExit: 5,
  /** Interactables (solid; interact from an adjacent tile). */
  CraftingTable: 6,
  Stash: 7,
  /** Overworld portal into the region's shared safe room. */
  DoorSafeRoom: 8,
  /** Infinite-height void cell; it has no walkable surface. */
  Void: 9,
  /**
   * Structural wall core used when VOID terrain is disabled. Its finite height
   * exists only to draw ordinary wall faces; collision treats it as infinitely
   * tall so jumping never turns thick uncarved separators into shortcuts.
   */
  Bedrock: 10,
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

export const FEATURE_FACE = {
  Top: 0,
  North: 1,
  East: 2,
  South: 3,
  West: 4,
} as const;
export type FeatureFace = (typeof FEATURE_FACE)[keyof typeof FEATURE_FACE];

/** Generator-only uncarved mask value. It is never written to a runtime Chunk. */
export const TOPOLOGY = { Uncarved: 1 } as const;

/**
 * Authoritative terrain plane. A runtime cell has either a finite Floor
 * surface (whose z comes from Chunk.height) or no surface at all (Void).
 * Stairs, doors, and other authored content remain overlays during this
 * migration; they do not create a third terrain kind.
 */
export const TERRAIN = {
  Floor: 0,
  Void: 1,
} as const;
export type TerrainType = (typeof TERRAIN)[keyof typeof TERRAIN];

/**
 * Occupancy features that block movement outright. Wall-mounted doors do not
 * occupy their map cell: the underlying raised terrain or VOID shell provides
 * collision while the feature replaces one visual wall-face segment.
 * Generated void cells are also blocked by World.isWalkable; they are an
 * infinite-height collision boundary even though they render flat in 2D.
 * Bedrock retains a finite render height but uses the same absolute movement
 * boundary, so physics never depends on an Infinity value in the height map.
 * Projectiles use the same terrain plane and height barriers as movement.
 */
export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE.CraftingTable,
  TILE.Stash,
  TILE.Void,
  TILE.Bedrock,
]);

export const ZONE = {
  None: 0,
  Sanctuary: 1,
} as const;
export type ZoneType = (typeof ZONE)[keyof typeof ZONE];

/** One generated chunk: CHUNK_SIZE × CHUNK_SIZE tiles, row-major. */
export interface Chunk {
  readonly cx: number;
  readonly cy: number;
  /** TileType per tile. */
  readonly tiles: Uint8Array;
  /** Authoritative Floor/Void terrain plane; never contains a Wall value. */
  readonly terrain: Uint8Array;
  /** Feature plane: zero for no feature, otherwise Stairs/door/interactable code. */
  readonly features: Uint8Array;
  /** FeatureFace per feature cell. */
  readonly featureFaces: Uint8Array;
  /** Absolute top elevation for each feature; zero where no feature exists. */
  readonly featureHeight: Float32Array;
  /** Continuous terrain height per tile. */
  readonly height: Float32Array;
  /** ZoneType per tile (sanctuary etc.). */
  readonly zones: Uint8Array;
}

/** Runtime feature overlay that leaves the underlying terrain untouched. */
export interface TileFeatureOverride {
  readonly x: number;
  readonly y: number;
  readonly tile: TileType;
  readonly featureFace: FeatureFace;
  readonly featureHeight: number;
}

/**
 * The read surface movement and AI need. `World` implements it; tests
 * can substitute a handcrafted fake.
 */
export interface WorldView {
  isWalkable(wx: number, wy: number): boolean;
  /** Optional authoritative terrain kind for render-only occlusion decisions. */
  terrainAt?: (wx: number, wy: number) => TerrainType;
  heightAt(wx: number, wy: number): number;
  /**
   * Continuous ground height at a POSITION (not a tile): flat tiles
   * return their height, stair tiles ramp linearly along their climb
   * axis (see world/stairs.ts). This is what bodies stand on — mid-
   * staircase you're physically at z 1.2, 1.4, … not a stepped 1.
   */
  groundAt(x: number, y: number): number;
  /**
   * Ramp height at a POSITION iff it sits on a TILE.Stairs tile, else
   * null. Lets movement physics detect "on a stair" (the glide + rim-gate
   * walkability rule, entities/movement/{physics,collision}.ts) without
   * importing TILE itself. Unlike groundAt, this is null off a Stairs
   * tile even where a flat neighbor happens to sit flush with one —
   * see docs/R2-STAIRS-SPEC.md section 3.
   */
  stairHeightAt(x: number, y: number): number | null;
}
