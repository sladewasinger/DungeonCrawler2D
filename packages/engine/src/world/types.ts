/** Core spatial types for the deterministic infinite chunked overworld. */

export const CHUNK_SIZE = 32;
export const TILE_PX = 16;

export const enum GroundKind {
  DeepWater = 0,
  ShallowWater = 1,
  Sand = 2,
  Grass = 3,
  MeadowGrass = 4,
  ForestFloor = 5,
  DirtPath = 6,
  CliffStone = 7,
  MossStone = 8,
}

export const enum PropKind {
  OakTree = "oak-tree",
  PineTree = "pine-tree",
  Bush = "bush",
  TallGrass = "tall-grass",
  Boulder = "boulder",
  Wildflower = "wildflower",
  Campfire = "campfire",
  Torch = "torch",
  Stump = "stump",
  Palisade = "palisade",
  Tent = "tent",
  RuinPillar = "ruin-pillar",
  CopperVein = "copper-vein",
  IronVein = "iron-vein",
  Workbench = "workbench",
  Bed = "bed",
  WoodChest = "wood-chest",
}

export type BiomeKind = "verdant-glade" | "deep-forest" | "riverbank" | "highland-ridge";
export type PoiKind = "bandit-camp" | "ancient-ruins";
export type PoiLayoutKind =
  | "camp-outpost"
  | "camp-l-shape"
  | "camp-courtyard"
  | "camp-warband"
  | "ruins-shrine"
  | "ruins-colonnade"
  | "ruins-sanctum";

export interface ChunkPoi {
  readonly id: string;
  readonly kind: PoiKind;
  readonly layout: PoiLayoutKind;
  readonly cx: number;
  readonly cy: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly elevation: number;
  readonly chestX: number;
  readonly chestY: number;
}

export interface ChunkProp {
  readonly id: string;
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  readonly variant: number;
  readonly elevation: number;
  readonly radius: number;
  readonly blocksMovement: boolean;
}

export interface PointLightSpec {
  readonly id: string;
  readonly kind: "campfire" | "torch" | "firefly";
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly radiusPx: number;
  readonly intensity: number;
}

export interface WorldChunk {
  readonly cx: number;
  readonly cy: number;
  readonly ground: Uint8Array;
  readonly elevation: Uint8Array;
  readonly stairs: Uint8Array;
  readonly variant: Uint8Array;
  readonly props: readonly ChunkProp[];
  readonly lights: readonly PointLightSpec[];
  readonly pois: readonly ChunkPoi[];
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function worldTileIndex(lx: number, ly: number): number {
  return ly * CHUNK_SIZE + lx;
}

export function worldToChunkCoord(worldTile: number): number {
  return Math.floor(worldTile / CHUNK_SIZE);
}

export function worldToLocalCoord(worldTile: number, chunkCoord: number): number {
  return worldTile - chunkCoord * CHUNK_SIZE;
}
