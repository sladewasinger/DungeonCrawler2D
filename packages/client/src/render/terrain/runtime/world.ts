import type { TerrainType, TileType, WorldFeatures } from "@dc2d/engine";

export interface TerrainWorld {
  readonly tileRevision: number;
  readonly worldSeed?: number;
  readonly floor?: number;
  readonly features: WorldFeatures;
  terrainAt(x: number, y: number): TerrainType;
  heightAt(x: number, y: number): number;
  tileAt(x: number, y: number): TileType;
}
