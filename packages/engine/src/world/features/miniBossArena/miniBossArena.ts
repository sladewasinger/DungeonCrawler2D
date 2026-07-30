import { hash2D, mixSeeds } from "../../../core/rng.js";
import {
  CHUNK_SIZE,
  TILE,
  type Chunk,
  type FeatureFace,
} from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import { isLandmarkChunk } from "../../generate/layout/district.js";
import { isBossArenaChunk } from "../bossArena/bossArena.js";
import {
  isStairwayDownChunk,
  isStairwayUpChunk,
} from "../descent/descent.js";
import { FLOOR_CAP } from "../descent/descentShared.js";
import { isSafeRoomChunk, isStairsChunk } from "../fixed/fixed.js";
import { isRoomChunk } from "../rooms/locations/roomLocations.js";
import { overlapsSpawnRoomExterior } from "../rooms/spawnExterior/spawnRoomExterior.js";
import {
  arenaBoundsForChunk,
  buildMiniBossArenaSite,
} from "./miniBossArenaGeometry.js";
import { generatedMiniBossArenaFeatureAt } from "./miniBossArenaGeneratedFeature.js";

const TUNING = WORLD_GENERATION_TUNING.miniBossArena;
const PLACEMENT_SALT = 0xa8e4;

export * from "./miniBossArenaCompass.js";

export interface MiniBossArenaBounds {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface MiniBossArenaGate {
  readonly x: number;
  readonly y: number;
  readonly featureFace: FeatureFace;
  readonly inside: { readonly x: number; readonly y: number };
  readonly outside: { readonly x: number; readonly y: number };
}

export interface MiniBossArenaPlatform {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly screenDepthTiles: number;
}

export interface MiniBossArenaSite {
  readonly key: string;
  readonly chunk: { readonly cx: number; readonly cy: number };
  readonly bounds: MiniBossArenaBounds;
  readonly interior: MiniBossArenaBounds;
  readonly center: { readonly x: number; readonly y: number };
  readonly gates: readonly MiniBossArenaGate[];
  readonly platforms: readonly MiniBossArenaPlatform[];
}

export interface MiniBossArenaChunk {
  readonly worldSeed: number;
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
}

export function miniBossArenaForChunk(
  chunk: MiniBossArenaChunk,
): MiniBossArenaSite | null {
  if (!miniBossArenaEligibleForChunk(chunk)) return null;
  const roll = miniBossArenaPlacementRoll(chunk);
  if (roll % TUNING.eligibleChunkFrequency !== 0) return null;
  const bounds = arenaBoundsForChunk(chunk, roll);
  return bounds ? buildMiniBossArenaSite(chunk, bounds) : null;
}

/** The chunks eligible for the developer-tuned mini-boss arena frequency. */
export function miniBossArenaEligibleForChunk(
  chunk: MiniBossArenaChunk,
): boolean {
  return chunk.floor >= 1 &&
    chunk.floor < FLOOR_CAP &&
    !isRoomChunk(chunk.cy) &&
    !isClaimedStructureChunk(chunk) &&
    !overlapsSpawnRoomExterior({
      ...chunk,
      rect: { x0: 0, y0: 0, x1: CHUNK_SIZE - 1, y1: CHUNK_SIZE - 1 },
    });
}

export function miniBossArenaPlacementRoll(
  chunk: MiniBossArenaChunk,
): number {
  const seed = mixSeeds(chunk.worldSeed, chunk.floor, PLACEMENT_SALT);
  return hash2D(seed, chunk.cx, chunk.cy);
}

export function miniBossArenaAtGate(
  world: MiniBossArenaWorld,
  x: number,
  y: number,
): MiniBossArenaSite | null {
  const site = miniBossArenaForChunk({
    ...world,
    cx: Math.floor(x / CHUNK_SIZE),
    cy: Math.floor(y / CHUNK_SIZE),
  });
  return site &&
    (!world.featureAt || world.featureAt(x, y) === TILE.ArenaGate) &&
    site.gates.some((gate) => gate.x === x && gate.y === y)
    ? site
    : null;
}

export function miniBossArenaAtPosition(
  world: MiniBossArenaWorld,
  x: number,
  y: number,
): MiniBossArenaSite | null {
  const site = miniBossArenaForChunk({
    ...world,
    cx: Math.floor(x / CHUNK_SIZE),
    cy: Math.floor(y / CHUNK_SIZE),
  });
  return site &&
    miniBossArenaIsStamped(world, site) &&
    containsPoint(site.bounds, x, y)
    ? site
    : null;
}

export interface MiniBossArenaWorld {
  readonly worldSeed: number;
  readonly floor: number;
  readonly featureAt?: (x: number, y: number) => number;
  readonly getChunk?: (cx: number, cy: number) => Pick<Chunk, "features">;
}

/** Runtime guard for a deterministic site skipped due to an authored feature. */
export function miniBossArenaIsStamped(
  world: MiniBossArenaWorld,
  site: MiniBossArenaSite,
): boolean {
  if (!world.featureAt && !world.getChunk) return true;
  return site.gates.every(({ x, y }) =>
    generatedMiniBossArenaFeatureAt(world, x, y) === TILE.ArenaGate
  );
}

export function containsPoint(
  bounds: MiniBossArenaBounds,
  x: number,
  y: number,
): boolean {
  return x >= bounds.x0 && x < bounds.x1 + 1 &&
    y >= bounds.y0 && y < bounds.y1 + 1;
}

function isClaimedStructureChunk(chunk: MiniBossArenaChunk): boolean {
  return isSafeRoomChunk(chunk) ||
    isStairsChunk(chunk) ||
    isStairwayUpChunk(chunk) ||
    isStairwayDownChunk(chunk) ||
    isBossArenaChunk(chunk) ||
    isLandmarkChunk(chunk.cx, chunk.cy);
}
