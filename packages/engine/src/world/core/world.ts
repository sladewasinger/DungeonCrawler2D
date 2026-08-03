/* eslint-disable max-lines -- World is the intentional compatibility boundary for all terrain consumers. */
import { LEVEL, type LevelId } from "./level.js";
import { snapshotLevelWorldFeatures, type WorldFeatures, type WorldOptions } from "./worldFeatures.js";
import { stairRampAt } from "../stairs/stairs.js";
import { generateCombatSandboxChunk } from "../combatSandbox/combatSandboxChunk.js";
import {
  finiteFloorForRuntime,
  floorBiomeAt,
  floorTerritoryAt,
  cloneGeneratedFloor,
  sliceGeneratedFloorChunk,
  type FloorBounds,
  type GeneratedFloor,
} from "../generate/finiteFloor.js";
import { floorConfigurationFingerprint, normalizeFloorGenerationConfig } from "../generate/config/floorGenerationConfig.js";
import { generateRoomChunk, isRoomIsolationChunk } from "../features/rooms/rooms.js";
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
import { measureWorldWork } from "../runtimeWork.js";

export class World implements WorldView {
  private readonly chunks = new Map<number, Map<number, Chunk>>();
  private readonly terrain: WorldTerrain;
  private chunkRevision = 0;

  readonly level: LevelId;
  readonly features: WorldFeatures;
  readonly generatedFloor: GeneratedFloor | null;
  private readonly canonicalFloor: GeneratedFloor | null;

  constructor(
    readonly worldSeed: number,
    readonly floor: number,
    options: LevelId | WorldOptions = LEVEL.Dungeon,
  ) {
    this.level = typeof options === "string" ? options : options.level ?? LEVEL.Dungeon;
    this.features = snapshotLevelWorldFeatures(
      this.level,
      typeof options === "string" ? undefined : options.features,
    );
    this.canonicalFloor = createCanonicalFloor({ worldSeed, floor, level: this.level, features: this.features, options });
    // finiteFloorForRuntime owns the canonical, deterministic indexed floor.
    // Keep one reference here; active chunk slices remain bounded separately.
    this.generatedFloor = this.canonicalFloor
      ? cloneGeneratedFloor(this.canonicalFloor)
      : null;
    this.assertExpectedGeneration(
      this.canonicalFloor,
      typeof options === "string" ? undefined : options.expectedGeneration,
    );
    this.terrain = new WorldTerrain({
      voidTerrain: this.features.voidTerrain,
      ...(this.canonicalFloor ? { generatedFloor: this.canonicalFloor } : {}),
      lookup: (wx, wy) => this.lookup(wx, wy),
      cachedLookup: (wx, wy) => this.cachedLookup(wx, wy),
    });
  }

  getChunk(cx: number, cy: number): Chunk {
    return measureWorldWork("world.getChunk", () => {
      const cached = this.chunks.get(cx)?.get(cy);
      if (cached) return cached;
      const chunk = this.generateRequestedChunk(cx, cy);
      if (this.shouldCacheChunk(cx, cy)) this.cacheChunk(cx, cy, chunk);
      return chunk;
    });
  }

  private cacheChunk(cx: number, cy: number, chunk: Chunk): void {
    const generated = this.canonicalFloor;
    if (this.level === LEVEL.Sandbox && generated) this.cacheSandboxWindow({ cx, cy, chunk, generated });
    else storeGeneratedChunk(this.chunks, chunk);
    this.chunkRevision++;
  }

  private cacheSandboxWindow(input: { readonly cx: number; readonly cy: number; readonly chunk: Chunk; readonly generated: GeneratedFloor }): void {
    for (const offset of SANDBOX_WINDOW_OFFSETS) this.cacheSandboxNeighbor({ ...input, ...offset });
  }

  private cacheSandboxNeighbor(input: { readonly cx: number; readonly cy: number; readonly chunk: Chunk; readonly generated: GeneratedFloor; readonly dx: number; readonly dy: number }): void {
    const neighborX = input.cx + input.dx;
    const neighborY = input.cy + input.dy;
    if (!chunkInsideBounds(input.generated.bounds, neighborX, neighborY)) return;
    const neighbor = input.dx === 0 && input.dy === 0
      ? input.chunk
      : sliceGeneratedFloorChunk(input.generated, neighborX, neighborY);
    storeGeneratedChunk(this.chunks, neighbor);
  }

  private lookup(wx: number, wy: number): TerrainCell {
    const cell = chunkCellAt(wx, wy);
    const cached = this.chunks.get(cell.cx)?.get(cell.cy);
    return { chunk: cached ?? this.getChunk(cell.cx, cell.cy), index: cell.index };
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

  /** Runtime finite floors do not retain a second slice cache after eviction. */
  get finiteSliceCount(): number { return 0; }

  get chunkCacheRevision(): number { return this.chunkRevision; }

  get floorBounds(): FloorBounds | null { return this.canonicalFloor ? { ...this.canonicalFloor.bounds } : null; }

  get stairTreadCount(): number | undefined { return this.canonicalFloor?.configuration.stairTreadCount; }

  get floorIdentity() {
    const identity = this.canonicalFloor?.identity;
    return identity ? { ...identity, bounds: { ...identity.bounds } } : null;
  }

  biomeAtWorldTile(wx: number, wy: number) {
    return this.canonicalFloor
      ? floorBiomeAt(this.canonicalFloor, wx, wy)
      : null;
  }

  territoryAtWorldTile(wx: number, wy: number): number | null {
    return this.canonicalFloor ? floorTerritoryAt(this.canonicalFloor, wx, wy) : null;
  }

  downStairwayPositions(): readonly { readonly x: number; readonly y: number }[] {
    return this.canonicalFloor?.downStairways.map(({ position }) => ({ ...position })) ?? [];
  }

  upStairwayPosition(): { readonly x: number; readonly y: number } | null {
    const position = this.canonicalFloor?.upStairway?.position;
    return position ? { ...position } : null;
  }

  pruneChunkCache(centerWx: number, centerWy: number, capacity: number): void {
    const chunkCount = this.cachedChunkCount;
    const center = chunkCellAt(centerWx, centerWy);
    pruneGeneratedChunks(this.chunks, { centerCx: center.cx, centerCy: center.cy, capacity });
    if (this.cachedChunkCount !== chunkCount) this.chunkRevision++;
  }

  private generateRequestedChunk(cx: number, cy: number): Chunk {
    if (this.level === LEVEL.CombatSandbox || (this.level === LEVEL.Sandbox && this.floor <= 0)) {
      return generateCombatSandboxChunk(cx, cy);
    }
    if (isRoomIsolationChunk(cy)) return generateRoomChunk(cx, cy);
    if (!this.canonicalFloor) throw new Error("Dungeon floor was not initialized");
    if (this.level !== LEVEL.Dungeon) return sliceGeneratedFloorChunk(this.canonicalFloor, cx, cy);
    return this.finiteFloorSlice(cx, cy);
  }

  private finiteFloorSlice(cx: number, cy: number): Chunk {
    return measureWorldWork("world.sliceFiniteChunk", () => {
      const floor = this.canonicalFloor;
      if (!floor) throw new Error("Dungeon floor was not initialized");
      return sliceGeneratedFloorChunk(floor, cx, cy);
    });
  }

  private shouldCacheChunk(cx: number, cy: number): boolean {
    const bounds = this.canonicalFloor?.bounds;
    if (this.level === LEVEL.CombatSandbox || isSandboxFloorZero(this.level, this.floor) || isRoomIsolationChunk(cy)) return true;
    if (bounds && !chunkInsideBounds(bounds, cx, cy)) return false;
    return bounds ? chunkInsideBounds(bounds, cx, cy) : false;
  }

  private assertExpectedGeneration(
    floor: GeneratedFloor | null,
    expected: WorldOptions["expectedGeneration"],
  ): void {
    if (!expected || !floor) return;
    if (!sameGenerationIdentity(expected, floor.identity)) {
      throw new Error(`Finite floor generation identity mismatch for floor ${this.floor}`);
    }
  }
}

function isSandboxFloorZero(level: LevelId, floor: number): boolean {
  return level === LEVEL.Sandbox && floor <= 0;
}

function sameGenerationIdentity(
  expected: NonNullable<WorldOptions["expectedGeneration"]>,
  actual: GeneratedFloor["identity"],
): boolean {
  return sameNumberTuple(
    [expected.seed, expected.generatorVersion, expected.retryIndex],
    [actual.seed, actual.generatorVersion, actual.retryIndex],
  ) && expected.configurationFingerprint === actual.configurationFingerprint
    && expected.fingerprint === actual.fingerprint
    && sameBounds(expected.bounds, actual.bounds);
}

function sameBounds(expected: FloorBounds, actual: FloorBounds): boolean {
  return sameNumberTuple(
    [expected.minX, expected.minY, expected.width, expected.height, expected.maxX, expected.maxY,
      expected.minChunkX, expected.minChunkY, expected.maxChunkX, expected.maxChunkY],
    [actual.minX, actual.minY, actual.width, actual.height, actual.maxX, actual.maxY,
      actual.minChunkX, actual.minChunkY, actual.maxChunkX, actual.maxChunkY],
  );
}

function sameNumberTuple(expected: readonly number[], actual: readonly number[]): boolean {
  return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
}

function chunkInsideBounds(bounds: FloorBounds, cx: number, cy: number): boolean {
  return cx >= bounds.minChunkX && cx <= bounds.maxChunkX &&
    cy >= bounds.minChunkY && cy <= bounds.maxChunkY;
}

const SANDBOX_WINDOW_OFFSETS = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));

function createCanonicalFloor(input: {
  readonly worldSeed: number;
  readonly floor: number;
  readonly level: LevelId;
  readonly features: WorldFeatures;
  readonly options: LevelId | WorldOptions;
}): GeneratedFloor | null {
  if (isCompatibilityWorld(input)) return null;
  const supplied = suppliedFloor(input);
  if (supplied) return supplied;
  const generation = generationOptions(input.options);
  return finiteFloorForRuntime({
    worldSeed: input.worldSeed,
    floor: input.floor,
    features: input.features,
    ...(generation ? { config: generation } : {}),
  });
}

function isCompatibilityWorld(input: { readonly level: LevelId; readonly floor: number }): boolean {
  return input.level === LEVEL.CombatSandbox || (input.level === LEVEL.Sandbox && input.floor <= 0);
}

function suppliedFloor(input: Parameters<typeof createCanonicalFloor>[0]): GeneratedFloor | undefined {
  if (typeof input.options === "string" || !input.options.generatedFloor) return undefined;
  const floor = input.options.generatedFloor;
  assertSuppliedFloorIdentity({
    floor, worldSeed: input.worldSeed, floorNumber: input.floor,
    features: input.features, generation: input.options.generation,
  });
  return floor;
}

function generationOptions(options: LevelId | WorldOptions): WorldOptions["generation"] {
  return typeof options === "string" ? undefined : options.generation;
}

function assertSuppliedFloorIdentity(input: {
  readonly floor: GeneratedFloor;
  readonly worldSeed: number;
  readonly floorNumber: number;
  readonly features: WorldFeatures;
  readonly generation?: WorldOptions["generation"];
}): void {
  if (input.floor.worldSeed !== input.worldSeed || input.floor.floor !== input.floorNumber) {
    throw new Error("Supplied finite floor does not match the requested world identity");
  }
  if (input.floor.voidTerrain !== input.features.voidTerrain) {
    throw new Error("Supplied finite floor does not match the requested terrain mode");
  }
  if (!input.generation) return;
  const suppliedFingerprint = floorConfigurationFingerprint(normalizeFloorGenerationConfig(input.generation));
  if (suppliedFingerprint !== input.floor.identity.configurationFingerprint) {
    throw new Error("Supplied finite floor does not match the requested generation configuration");
  }
}

export type { CachedTerrainTile } from "./worldCachedTerrain.js";
