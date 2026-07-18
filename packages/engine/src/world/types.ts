// Core world data shapes: tile/zone vocabularies and the read-only view movement and AI depend on.

export const CHUNK_SIZE = 32;

export const TILE = {
  Floor: 0,
  Wall: 1,
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
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

/**
 * Solid tiles that block movement outright (furniture). Walls are NOT
 * here: a wall is terrain raised WALL_RISE — its height blocks walking,
 * and its top is a walkable platform you can jump onto.
 */
export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE.CraftingTable,
  TILE.Stash,
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
}
