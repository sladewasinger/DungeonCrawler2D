import { hashString, mixSeeds } from "../../../core/rng.js";
import { TILE, TOPOLOGY } from "../../core/types.js";
import { carveCell, forEachCell } from "../finiteFloorBuffers.js";
import {
  FLOOR_SEMANTIC,
  type FloorBounds,
  type FloorBuffers,
  type FloorPoint,
  type FloorRect,
  type GeneratedFeatureStamp,
} from "../finiteFloorTypes.js";
import { borderDistance, fbmNoise2D, insideProtectedFeatureArea, nearSpawn, pointInRect } from "./forestNoise.js";
import { smoothHillSlopes } from "./openWorldHillSmoothing.js";
import { sealIsolatedTerrainPockets } from "./openWorldPocketSeal.js";

export interface OpenWorldTerrainInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly spawn: FloorPoint;
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly sealedArenas: readonly FloorRect[];
}

const MIN_BORDER = 6;
const BORDER_VARIATION = 6;
const ROCK_OUTCROP_THRESHOLD = 0.14;
const HILL_STEP = 0.25;
const MAX_HILL_HEIGHT = 1.5;
const MIN_HILL_HEIGHT = 0;
const SAND_THRESHOLD = 0.72;
const MEADOW_THRESHOLD = 0.56;

export function generateOpenWorldTerrain(input: OpenWorldTerrainInput): void {
  const terrainSeed = mixSeeds(input.seed, hashString("open-world-terrain"));
  const pinned = buildPinnedPadMask(input);
  carveRollingInterior(input, terrainSeed, pinned);
  sealIsolatedTerrainPockets({ buffers: input.buffers, bounds: input.bounds, spawn: input.spawn });
  assignBiomesAndSurfaces(input, terrainSeed);
}

export function smoothOpenWorldHills(input: OpenWorldTerrainInput): void {
  const pinned = buildPinnedPadMask(input);
  forEachCell(input.bounds, (_x, _y, index) => {
    const feature = input.buffers.features[index] ?? TILE.Floor;
    if (feature === TILE.Water || feature === TILE.Bridge || (input.buffers.height[index] ?? 0) < 0) {
      pinned[index] = 1;
    }
  });
  smoothHillSlopes(input.buffers, input.bounds, pinned);
}

function buildPinnedPadMask(input: OpenWorldTerrainInput): Uint8Array {
  const pinned = new Uint8Array(input.buffers.tiles.length);
  forEachCell(input.bounds, (x, y, index) => {
    const point = { x, y };
    if (nearSpawn(point, input.spawn, 6) || insideProtectedFeatureArea({ point, featureStamps: input.featureStamps, sealedArenas: input.sealedArenas })) {
      pinned[index] = 1;
    }
  });
  return pinned;
}

function carveRollingInterior(input: OpenWorldTerrainInput, seed: number, pinned: Uint8Array): void {
  const hillSeed = mixSeeds(seed, 0x1b71);
  forEachCell(input.bounds, (x, y, index) => {
    const point = { x, y };
    if (input.buffers.tiles[index] !== TOPOLOGY.Uncarved) return;
    if (insideExactFeature(point, input.featureStamps, input.sealedArenas)) return;
    if (borderDistance(input.bounds, point) < borderMarginAt(seed, point)) return;
    if (!pinned[index] && fbmNoise2D({ seed, x, y, scale: 34 }) < ROCK_OUTCROP_THRESHOLD) return;
    carveCell({ buffers: input.buffers, index, semantic: FLOOR_SEMANTIC.Corridor, regionId: 1 });
    input.buffers.height[index] = pinned[index] ? 0 : sampleHillHeight(hillSeed, x, y);
  });
}

function insideExactFeature(
  point: FloorPoint,
  stamps: readonly GeneratedFeatureStamp[],
  arenas: readonly FloorRect[],
): boolean {
  return stamps.some((stamp) => pointInRect(point, stamp.bounds, 0))
    || arenas.some((arena) => pointInRect(point, arena, 0));
}

function borderMarginAt(seed: number, point: FloorPoint): number {
  const sample = fbmNoise2D({ seed: mixSeeds(seed, 0x3b17), x: point.x, y: point.y, scale: 22 });
  return MIN_BORDER + Math.floor(sample * BORDER_VARIATION);
}

function sampleHillHeight(seed: number, x: number, y: number): number {
  const raw = fbmNoise2D({ seed, x, y, scale: 30 });
  const scaled = MIN_HILL_HEIGHT + raw * (MAX_HILL_HEIGHT - MIN_HILL_HEIGHT);
  return Math.round(scaled / HILL_STEP) * HILL_STEP;
}

function assignBiomesAndSurfaces(input: OpenWorldTerrainInput, seed: number): void {
  const midX = Math.floor((input.bounds.minX + input.bounds.maxX) / 2);
  const midY = Math.floor((input.bounds.minY + input.bounds.maxY) / 2);
  const sandSeed = mixSeeds(seed, 0x77e1);
  const meadowSeed = mixSeeds(seed, 0x9123);
  forEachCell(input.bounds, (x, y, index) => {
    input.buffers.biome[index] = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
    input.buffers.territory[index] = surfaceTerritoryAt({ buffers: input.buffers, x, y, index, sandSeed, meadowSeed });
  });
}

function surfaceTerritoryAt(input: {
  readonly buffers: FloorBuffers;
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly sandSeed: number;
  readonly meadowSeed: number;
}): number {
  const sand = fbmNoise2D({ seed: input.sandSeed, x: input.x, y: input.y, scale: 26 });
  if (sand > SAND_THRESHOLD) return 2;
  const height = input.buffers.height[input.index] ?? 0;
  const meadow = fbmNoise2D({ seed: input.meadowSeed, x: input.x, y: input.y, scale: 20 });
  return height >= 0.5 || meadow > MEADOW_THRESHOLD ? 1 : 0;
}
