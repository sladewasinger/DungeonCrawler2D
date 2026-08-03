import type {
  FeatureFace,
  FloorBounds,
  FloorGenerationIdentity,
  TerrainType,
  TileType,
  WorldFeatures,
} from "@dc2d/engine";

export interface TerrainWorld {
  readonly tileRevision: number;
  readonly worldSeed?: number;
  readonly floor?: number;
  readonly features: WorldFeatures;
  readonly stairTreadCount?: number | undefined;
  readonly floorBounds?: FloorBounds | null;
  readonly floorIdentity?: FloorGenerationIdentity | null;
  territoryAtWorldTile?(x: number, y: number): number | null;
  terrainAt(x: number, y: number): TerrainType;
  heightAt(x: number, y: number): number;
  tileAt(x: number, y: number): TileType;
  surfaceTileAt?(x: number, y: number): TileType;
  featureAt(x: number, y: number): TileType;
  featureFaceAt(x: number, y: number): FeatureFace;
  featureHeightAt(x: number, y: number): number;
  pruneChunkCache?(centerWx: number, centerWy: number, capacity: number): void;
}
