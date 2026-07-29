import { CHASM_DEATH_Z } from "../../core/constants.js";
import { generateDistrictChunks } from "../generate.js";
import { LEVEL, type LevelId } from "./level.js";
import { snapshotWorldFeatures, type WorldFeatures, type WorldOptions } from "./worldFeatures.js";
import { stairRampAt } from "../stairs/stairs.js";
import {
  chunkCellAt,
  generatedChunkCount,
  pruneGeneratedChunks,
  storeGeneratedChunk,
} from "./chunkCoordinates.js";
import {
  featureOverrideMap,
  featureFromTile,
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
  type WorldView,
  type ZoneType,
} from "./types.js";

/**
 * Lazy chunk cache over the deterministic generator. Both the game
 * server (authoritative) and the client (rendering + prediction)
 * construct one from the same seed, floor, level, and startup features
 * and see identical terrain.
 */
export class World implements WorldView {
  // Two-level Map (cx -> cy -> Chunk), not a `${cx},${cy}` string key: this lookup sits
  // behind every heightAt/tileAt/zoneAt call, and those get called ~16x more often per
  // tile since MAX_FACE_ROWS rose 3 -> 16 (ownFace.ts) for the explicit-heights reskin.
  // Native number keys skip the per-call template-string allocation + hash that a string
  // key would otherwise pay on every single terrain read.
  private readonly chunks = new Map<number, Map<number, Chunk>>();
  private tileOverrides = new Map<string, TileType>();
  private featureOverrides = new Map<string, StoredFeature>();
  tileRevision = 0;

  readonly level: LevelId;
  readonly features: WorldFeatures;

  constructor(
    readonly worldSeed: number,
    readonly floor: number,
    options: LevelId | WorldOptions = LEVEL.Dungeon,
  ) {
    this.level = typeof options === "string" ? options : options.level ?? LEVEL.Dungeon;
    this.features = snapshotWorldFeatures(typeof options === "string" ? undefined : options.features);
  }

  getChunk(cx: number, cy: number): Chunk {
    const cached = this.chunks.get(cx)?.get(cy);
    if (cached) return cached;
    const generated = generateDistrictChunks({
      worldSeed: this.worldSeed,
      floor: this.floor,
      cx,
      cy,
      level: this.level,
      features: this.features,
    });
    for (const chunk of generated) storeGeneratedChunk(this.chunks, chunk);
    const requested = this.chunks.get(cx)?.get(cy);
    if (requested) return requested;
    throw new Error(`Generation omitted chunk (${cx}, ${cy})`);
  }

  private lookup(wx: number, wy: number): { chunk: Chunk; index: number } {
    const cell = chunkCellAt(wx, wy);
    return { chunk: this.getChunk(cell.cx, cell.cy), index: cell.index };
  }

  tileAt(wx: number, wy: number): TileType {
    const overridden = this.tileOverrides.get(`${wx},${wy}`);
    if (overridden !== undefined) return overridden;
    const feature = this.featureAt(wx, wy);
    if (feature !== TILE.Floor) return feature;
    const { chunk, index } = this.lookup(wx, wy);
    if (chunk.terrain[index] === TERRAIN.Void) return TILE.Void;
    return (chunk.tiles[index] ?? TILE.Floor) as TileType;
  }

  featureAt(wx: number, wy: number): TileType {
    const key = `${wx},${wy}`;
    const tileOverride = this.tileOverrides.get(key);
    if (tileOverride !== undefined) return featureFromTile(tileOverride);
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.tile;
    const { chunk, index } = this.lookup(wx, wy);
    return (chunk.features[index] ?? TILE.Floor) as TileType;
  }

  featureHeightAt(wx: number, wy: number): number {
    const key = `${wx},${wy}`;
    const tileOverride = this.tileOverrides.get(key);
    if (tileOverride !== undefined) {
      return featureFromTile(tileOverride) === TILE.Floor ? 0 : this.heightAt(wx, wy);
    }
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.featureHeight;
    const { chunk, index } = this.lookup(wx, wy);
    return chunk.featureHeight[index] ?? 0;
  }

  featureFaceAt(wx: number, wy: number): FeatureFace {
    const key = `${wx},${wy}`;
    if (this.tileOverrides.has(key)) return FEATURE_FACE.Top;
    const featureOverride = this.featureOverrides.get(key);
    if (featureOverride) return featureOverride.featureFace;
    const { chunk, index } = this.lookup(wx, wy);
    return (chunk.featureFaces[index] ?? FEATURE_FACE.Top) as FeatureFace;
  }

  terrainAt(wx: number, wy: number): TerrainType {
    const overridden = this.tileOverrides.get(`${wx},${wy}`);
    if (overridden !== undefined) return overridden === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
    const { chunk, index } = this.lookup(wx, wy);
    return (chunk.terrain[index] ?? TERRAIN.Floor) as TerrainType;
  }

  replaceTileOverrides(
    overrides: readonly { x: number; y: number; tile: TileType }[],
  ): void {
    if (!this.features.voidTerrain && overrides.some(({ tile }) => tile === TILE.Void)) {
      throw new Error("VOID override leaked into disabled world");
    }
    const next = tileOverrideMap(overrides);
    if (sameTileOverrides(this.tileOverrides, next)) return;
    this.tileOverrides = next;
    this.tileRevision++;
  }

  replaceFeatureOverrides(overrides: readonly TileFeatureOverride[]): void {
    const next = featureOverrideMap(overrides);
    if (sameFeatureOverrides(this.featureOverrides, next)) return;
    this.featureOverrides = next;
    this.tileRevision++;
  }

  heightAt(wx: number, wy: number): number { const { chunk, index } = this.lookup(wx, wy); return chunk.height[index] ?? 0; }

  zoneAt(wx: number, wy: number): ZoneType { const { chunk, index } = this.lookup(wx, wy); return (chunk.zones[index] ?? ZONE.None) as ZoneType; }

  isWalkable(wx: number, wy: number): boolean {
    // Enabled VOID is an infinite boundary. Disabled mode restores legacy
    // finite chasm floors so movement can enter them and the death plane can
    // resolve the fall.
    if (SOLID_TILES.has(this.featureAt(wx, wy))) return false;
    if (!this.features.voidTerrain) return true;
    return this.terrainAt(wx, wy) !== TERRAIN.Void && this.heightAt(wx, wy) > CHASM_DEATH_Z;
  }

  /** Continuous ground height: stair tiles ramp with position. */
  groundAt(x: number, y: number): number { return stairRampAt(this, x, y) ?? this.heightAt(Math.floor(x), Math.floor(y)); }

  /** Ramp height iff (x, y) sits on a TILE.Stairs tile, else null — see WorldView's doc comment. */
  stairHeightAt(x: number, y: number): number | null {
    if (this.featureAt(Math.floor(x), Math.floor(y)) !== TILE.Stairs) return null;
    return stairRampAt(this, x, y);
  }

  isSanctuary(wx: number, wy: number): boolean { return this.zoneAt(wx, wy) === ZONE.Sanctuary; }

  get cachedChunkCount(): number { return generatedChunkCount(this.chunks); }

  pruneChunkCache(centerWx: number, centerWy: number, capacity: number): void {
    const center = chunkCellAt(centerWx, centerWy);
    pruneGeneratedChunks(this.chunks, { centerCx: center.cx, centerCy: center.cy, capacity });
  }
}
