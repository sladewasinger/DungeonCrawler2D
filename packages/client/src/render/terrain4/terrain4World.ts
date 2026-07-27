import type { TerrainType, TileType } from "@dc2d/engine";

export interface Terrain4World {
  readonly tileRevision: number;
  readonly worldSeed?: number;
  readonly floor?: number;
  terrainAt(x: number, y: number): TerrainType;
  heightAt(x: number, y: number): number;
  tileAt(x: number, y: number): TileType;
}
