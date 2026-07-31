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
  TILE,
  type Chunk,
  type WorldView,
} from "./types.js";
import {
  WorldTerrain,
  type TerrainCell,
} from "./worldTerrain.js";
import type { CachedTerrainTile } from "./worldCachedTerrain.js";

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
  private readonly terrain: WorldTerrain;
  private chunkRevision = 0;

  readonly level: LevelId;
  readonly features: WorldFeatures;

  constructor(
    readonly worldSeed: number,
    readonly floor: number,
    options: LevelId | WorldOptions = LEVEL.Dungeon,
  ) {
    this.level = typeof options === "string" ? options : options.level ?? LEVEL.Dungeon;
    this.features = snapshotWorldFeatures(typeof options === "string" ? undefined : options.features);
    this.terrain = new WorldTerrain({
      voidTerrain: this.features.voidTerrain,
      lookup: (wx, wy) => this.lookup(wx, wy),
      cachedLookup: (wx, wy) => this.cachedLookup(wx, wy),
    });
  }

  getChunk(cx: number, cy: number): Chunk {
    const cached = this.chunks.get(cx)?.get(cy);
    if (cached) return cached;
    const chunkCount = this.cachedChunkCount;
    const generated = generateDistrictChunks({
      worldSeed: this.worldSeed,
      floor: this.floor,
      cx,
      cy,
      level: this.level,
      features: this.features,
    });
    for (const chunk of generated) storeGeneratedChunk(this.chunks, chunk);
    if (this.cachedChunkCount !== chunkCount) this.chunkRevision++;
    const requested = this.chunks.get(cx)?.get(cy);
    if (requested) return requested;
    throw new Error(`Generation omitted chunk (${cx}, ${cy})`);
  }

  private lookup(wx: number, wy: number): TerrainCell {
    const cell = chunkCellAt(wx, wy);
    return { chunk: this.getChunk(cell.cx, cell.cy), index: cell.index };
  }

  private cachedLookup(wx: number, wy: number): TerrainCell | undefined {
    const cell = chunkCellAt(wx, wy);
    const chunk = this.chunks.get(cell.cx)?.get(cell.cy);
    if (!chunk) return undefined;
    return { chunk, index: cell.index };
  }

  tileAt(wx: number, wy: number) { return this.terrain.tileAt(wx, wy); }

  surfaceTileAt(wx: number, wy: number) { return this.terrain.surfaceTileAt(wx, wy); }

  featureAt(wx: number, wy: number) { return this.terrain.featureAt(wx, wy); }

  featureHeightAt(wx: number, wy: number) { return this.terrain.featureHeightAt(wx, wy); }

  featureFaceAt(wx: number, wy: number) { return this.terrain.featureFaceAt(wx, wy); }

  terrainAt(wx: number, wy: number) { return this.terrain.terrainAt(wx, wy); }

  replaceTileOverrides(overrides: Parameters<WorldTerrain["replaceTileOverrides"]>[0]): void {
    this.terrain.replaceTileOverrides(overrides);
  }

  replaceFeatureOverrides(overrides: Parameters<WorldTerrain["replaceFeatureOverrides"]>[0]): void {
    this.terrain.replaceFeatureOverrides(overrides);
  }

  heightAt(wx: number, wy: number) { return this.terrain.heightAt(wx, wy); }

  zoneAt(wx: number, wy: number) { return this.terrain.zoneAt(wx, wy); }

  /** Returns terrain only when its runtime chunk is already cached. */
  cachedTerrainAt(wx: number, wy: number): CachedTerrainTile | undefined {
    return this.terrain.cachedTerrainAt(wx, wy);
  }

  isWalkable(wx: number, wy: number) { return this.terrain.isWalkable(wx, wy); }

  /** Continuous ground height: stair tiles ramp with position. */
  groundAt(x: number, y: number): number { return stairRampAt(this, x, y) ?? this.heightAt(Math.floor(x), Math.floor(y)); }

  /** Ramp height iff (x, y) sits on a TILE.Stairs tile, else null — see WorldView's doc comment. */
  stairHeightAt(x: number, y: number): number | null {
    if (this.featureAt(Math.floor(x), Math.floor(y)) !== TILE.Stairs) return null;
    return stairRampAt(this, x, y);
  }

  isSanctuary(wx: number, wy: number): boolean { return this.terrain.isSanctuary(wx, wy); }

  get tileRevision(): number { return this.terrain.tileRevision; }

  get cachedChunkCount(): number { return generatedChunkCount(this.chunks); }

  get chunkCacheRevision(): number { return this.chunkRevision; }

  pruneChunkCache(centerWx: number, centerWy: number, capacity: number): void {
    const chunkCount = this.cachedChunkCount;
    const center = chunkCellAt(centerWx, centerWy);
    pruneGeneratedChunks(this.chunks, { centerCx: center.cx, centerCy: center.cy, capacity });
    if (this.cachedChunkCount !== chunkCount) this.chunkRevision++;
  }
}

export type { CachedTerrainTile } from "./worldCachedTerrain.js";
