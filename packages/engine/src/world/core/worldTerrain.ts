import {
  featureFromTile,
  featureOverrideMap,
  sameFeatureOverrides,
  sameTileOverrides,
  tileOverrideMap,
  type StoredFeature,
} from "./featureOverrides.js";
import {
  FEATURE_FACE,
  SOLID_TILES,
  TERRAIN,
  TILE,
  ZONE,
  type Chunk,
  type FeatureFace,
  type TerrainType,
  type TileFeatureOverride,
  type TileType,
  type ZoneType,
} from "./types.js";
import { cachedTerrainAt, type CachedTerrainTile } from "./worldCachedTerrain.js";
import { finiteFloorCellAt, type FiniteFloorCell } from "./terrain/worldFiniteFloorCell.js";
import type { GeneratedFloor } from "../generate/finiteFloorTypes.js";

export interface TerrainCell { readonly chunk: Chunk; readonly index: number; }
interface WorldTerrainAccess {
  readonly voidTerrain: boolean; readonly generatedFloor?: GeneratedFloor;
  readonly lookup: (wx: number, wy: number) => TerrainCell;
  readonly cachedLookup: (wx: number, wy: number) => TerrainCell | undefined;
}

export class WorldTerrain {
  private tileOverrides = new Map<string, TileType>();
  private featureOverrides = new Map<string, StoredFeature>();
  tileRevision = 0;

  constructor(private readonly access: WorldTerrainAccess) {}

  tileAt(wx: number, wy: number): TileType {
    const feature = this.featureAt(wx, wy);
    return feature !== TILE.Floor ? feature : this.surfaceTileAt(wx, wy);
  }

  surfaceTileAt(wx: number, wy: number): TileType {
    const overridden = this.tileOverrides.get(tileKey(wx, wy));
    if (overridden !== undefined) return surfaceOverride(overridden);
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.tile;
    const cell = this.access.lookup(wx, wy);
    return (cell.chunk.tiles[cell.index] ?? TILE.Floor) as TileType;
  }

  featureAt(wx: number, wy: number): TileType {
    const key = tileKey(wx, wy);
    const tileOverride = this.tileOverrides.get(key);
    if (tileOverride !== undefined) return featureFromTile(tileOverride);
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.tile;
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.feature;
    const cell = this.access.lookup(wx, wy);
    return (cell.chunk.features[cell.index] ?? TILE.Floor) as TileType;
  }

  featureHeightAt(wx: number, wy: number): number {
    const key = tileKey(wx, wy);
    const tileOverride = this.tileOverrides.get(key);
    if (tileOverride !== undefined) return featureHeightOverride(tileOverride, () => this.heightAt(wx, wy));
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.featureHeight;
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.featureHeight;
    const cell = this.access.lookup(wx, wy);
    return cell.chunk.featureHeight[cell.index] ?? 0;
  }

  featureFaceAt(wx: number, wy: number): FeatureFace {
    const key = tileKey(wx, wy);
    if (this.tileOverrides.has(key)) return FEATURE_FACE.Top;
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.featureFace;
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.featureFace;
    const cell = this.access.lookup(wx, wy);
    return (cell.chunk.featureFaces[cell.index] ?? FEATURE_FACE.Top) as FeatureFace;
  }

  terrainAt(wx: number, wy: number): TerrainType {
    const overridden = this.tileOverrides.get(tileKey(wx, wy));
    if (overridden !== undefined) return terrainOverride(overridden);
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.terrain;
    const cell = this.access.lookup(wx, wy);
    return (cell.chunk.terrain[cell.index] ?? TERRAIN.Floor) as TerrainType;
  }

  replaceTileOverrides(overrides: readonly { x: number; y: number; tile: TileType }[]): void {
    if (!this.access.voidTerrain && overrides.some(({ tile }) => tile === TILE.Void)) throw new Error("VOID override leaked into disabled world");
    const next = tileOverrideMap(overrides, (x, y) => this.heightAt(x, y));
    if (sameTileOverrides(this.tileOverrides, next)) return;
    this.tileOverrides = next; this.tileRevision++;
  }

  replaceFeatureOverrides(overrides: readonly TileFeatureOverride[]): void {
    const next = featureOverrideMap(overrides);
    if (sameFeatureOverrides(this.featureOverrides, next)) return;
    this.featureOverrides = next; this.tileRevision++;
  }

  heightAt(wx: number, wy: number): number {
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.height;
    const cell = this.access.lookup(wx, wy);
    return cell.chunk.height[cell.index] ?? 0;
  }

  zoneAt(wx: number, wy: number): ZoneType {
    const finite = this.finiteFloorCell(wx, wy);
    if (finite) return finite.zone;
    const cell = this.access.lookup(wx, wy);
    return (cell.chunk.zones[cell.index] ?? ZONE.None) as ZoneType;
  }

  cachedTerrainAt(wx: number, wy: number): CachedTerrainTile | undefined {
    const cell = this.access.cachedLookup(wx, wy);
    if (!cell) return undefined;
    return cachedTerrainAt({ cell, wx, wy, tileOverrides: this.tileOverrides, featureOverrides: this.featureOverrides });
  }

  isWalkable(wx: number, wy: number): boolean {
    return !SOLID_TILES.has(this.featureAt(wx, wy)) &&
      !SOLID_TILES.has(this.surfaceTileAt(wx, wy)) && this.terrainAt(wx, wy) !== TERRAIN.Void;
  }

  isSanctuary(wx: number, wy: number): boolean { return this.zoneAt(wx, wy) === ZONE.Sanctuary; }

  private finiteFloorCell(wx: number, wy: number): FiniteFloorCell | null {
    return finiteFloorCellAt(this.access.generatedFloor, wx, wy);
  }
}

const tileKey = (wx: number, wy: number): string => `${wx},${wy}`;
const surfaceOverride = (tile: TileType): TileType => featureFromTile(tile) === TILE.Floor ? tile : TILE.Floor;
const featureHeightOverride = (tile: TileType, heightAt: () => number): number => featureFromTile(tile) === TILE.Floor ? 0 : heightAt();
const terrainOverride = (tile: TileType): TerrainType => tile === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
