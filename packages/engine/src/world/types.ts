/** Core spatial types for the deterministic infinite chunked overworld. */
import {
  CHUNK_SIZE, GROUND_KIND_VALUES, GroundKind, PROP_KIND_VALUES, PropKind, TILE_PX,
  type BiomeKind, type DangerTier, type PoiCategory, type PoiKind, type PoiLayoutKind,
} from "@dc2d/contracts";

export { CHUNK_SIZE, GROUND_KIND_VALUES, GroundKind, PROP_KIND_VALUES, PropKind, TILE_PX };
export type { BiomeKind, DangerTier, PoiCategory, PoiKind, PoiLayoutKind };

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
  readonly hasChest?: boolean | undefined;
  readonly isSanctuary?: boolean | undefined;
  readonly eliteKind?: "spider" | "orc" | "golem" | "skeleton" | undefined;
  readonly eliteTitle?: string | undefined;
  readonly shrineKind?: "swiftness" | "vigor" | "shadow" | "waystone" | undefined;
  readonly loreText?: string | undefined;
  readonly brazierPositions?: readonly { readonly id: string; readonly x: number; readonly y: number }[] | undefined;
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
