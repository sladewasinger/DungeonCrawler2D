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

/** Solid tiles that block movement. */
export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE.Wall,
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
}
