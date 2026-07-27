// Core world data shapes: tile/zone vocabularies and the read-only view movement and AI depend on.

/** Runtime chunks are generated at 32 cells and doubled for gameplay space. */
export const CHUNK_SIZE = 64;

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
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

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
 * Solid feature tiles that block movement outright: furniture and doors. A raised Floor is blocked by the height
 * transition in movement/collision, while Void is an
 * infinite-height boundary.
 * Generated void cells are also blocked by World.isWalkable; they are an
 * infinite-height collision boundary even though they render flat in 2D.
 * Projectiles use the same terrain plane and height barriers as movement.
 */
export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE.CraftingTable,
  TILE.Stash,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
  TILE.DoorSafeRoom,
  TILE.Void,
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
  /** Continuous terrain height per tile. */
  readonly height: Float32Array;
  /** ZoneType per tile (sanctuary etc.). */
  readonly zones: Uint8Array;
}

/**
 * The read surface movement and AI need. `World` implements it; tests
 * can substitute a handcrafted fake.
 */
export interface WorldView {
  isWalkable(wx: number, wy: number): boolean;
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
