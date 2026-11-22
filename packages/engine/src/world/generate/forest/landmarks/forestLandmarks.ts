/** Stamps deterministic 7x7 Bandit Camps and Ancient Ruins into open forest chunks. */
import { hash2DFloat, hashString, mixSeeds } from "../../../../core/rng.js";
import { CHUNK_SIZE, TILE } from "../../../core/types.js";
import { insideBounds, localIndex } from "../../finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint } from "../../finiteFloorTypes.js";
import { borderDistance, hasOwnedRoomOrFeature, insideProtectedFeatureArea, nearSpawn } from "../forestNoise.js";
import type { ForestLayoutInput } from "../forestRivers.js";

const LANDMARK_HALF = 3;
const PROTECT_RADIUS = 4;

export function placeForestLandmarks(input: ForestLayoutInput): void {
  const landmarkSeed = mixSeeds(input.seed, hashString("forest-landmarks"));
  const { bounds } = input;
  for (let cy = bounds.minChunkY; cy <= bounds.maxChunkY; cy++) {
    for (let cx = bounds.minChunkX; cx <= bounds.maxChunkX; cx++) {
      tryStampChunkLandmark(input, { cx, cy, landmarkSeed });
    }
  }
}

function tryStampChunkLandmark(
  input: ForestLayoutInput,
  ctx: { readonly cx: number; readonly cy: number; readonly landmarkSeed: number },
): void {
  if (hash2DFloat(ctx.landmarkSeed, ctx.cx, ctx.cy) >= 0.56) return;
  const center = chunkLandmarkCenter(ctx);
  if (!canStampLandmark(input, center)) return;
  stampLandmarkFootprint({
    buffers: input.buffers,
    bounds: input.bounds,
    center,
    isCamp: ((ctx.cx + ctx.cy) & 1) === 0,
  });
}

function chunkLandmarkCenter(ctx: {
  readonly cx: number;
  readonly cy: number;
  readonly landmarkSeed: number;
}): FloorPoint {
  const ox = 11 + Math.floor(hash2DFloat(ctx.landmarkSeed + 17, ctx.cx, ctx.cy) * 10);
  const oy = 11 + Math.floor(hash2DFloat(ctx.landmarkSeed + 31, ctx.cx, ctx.cy) * 10);
  return { x: ctx.cx * CHUNK_SIZE + ox, y: ctx.cy * CHUNK_SIZE + oy };
}

function canStampLandmark(input: ForestLayoutInput, center: FloorPoint): boolean {
  const { buffers, bounds, spawn } = input;
  if (nearSpawn(center, spawn, 18) || borderDistance(bounds, center) < 8) return false;
  if (!insideBounds({ bounds, ...center })) return false;
  const baseHeight = buffers.height[localIndex({ bounds, ...center })] ?? 0;
  for (let dy = -PROTECT_RADIUS; dy <= PROTECT_RADIUS; dy++) {
    if (!isFootprintRowClear({ input, center, baseHeight, dy })) return false;
  }
  return true;
}

function isFootprintRowClear(ctx: {
  readonly input: ForestLayoutInput;
  readonly center: FloorPoint;
  readonly baseHeight: number;
  readonly dy: number;
}): boolean {
  const { input, center, baseHeight, dy } = ctx;
  for (let dx = -PROTECT_RADIUS; dx <= PROTECT_RADIUS; dx++) {
    const point = { x: center.x + dx, y: center.y + dy };
    if (!isLandmarkCellClear({ input, point, baseHeight })) return false;
  }
  return true;
}

function isLandmarkCellClear(ctx: {
  readonly input: ForestLayoutInput;
  readonly point: FloorPoint;
  readonly baseHeight: number;
}): boolean {
  const { buffers, bounds, featureStamps, sealedArenas } = ctx.input;
  if (!insideBounds({ bounds, ...ctx.point })) return false;
  const index = localIndex({ bounds, ...ctx.point });
  if (!isPlainWalkableCell(buffers, index, ctx.baseHeight)) return false;
  return !insideProtectedFeatureArea({ point: ctx.point, featureStamps, sealedArenas });
}

function isPlainWalkableCell(buffers: FloorBuffers, index: number, baseHeight: number): boolean {
  return buffers.tiles[index] === TILE.Floor
    && buffers.features[index] === TILE.Floor
    && (buffers.protectedCells[index] ?? 0) === 0
    && !hasOwnedRoomOrFeature(buffers, index)
    && (buffers.height[index] ?? 0) === baseHeight;
}

interface StampFootprintInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly center: FloorPoint;
  readonly isCamp: boolean;
}

function stampLandmarkFootprint(input: StampFootprintInput): void {
  for (let dy = -PROTECT_RADIUS; dy <= PROTECT_RADIUS; dy++) {
    for (let dx = -PROTECT_RADIUS; dx <= PROTECT_RADIUS; dx++) {
      stampFootprintCell(input, dx, dy);
    }
  }
}

function stampFootprintCell(input: StampFootprintInput, dx: number, dy: number): void {
  const { buffers, bounds, center, isCamp } = input;
  const index = localIndex({ bounds, x: center.x + dx, y: center.y + dy });
  buffers.protectedCells[index] = 1;
  if (Math.abs(dx) > LANDMARK_HALF || Math.abs(dy) > LANDMARK_HALF) return;
  const tile = isCamp ? campTileAt(dx, dy) : ruinTileAt(dx, dy);
  buffers.features[index] = tile;
  if (tile !== TILE.Floor) buffers.featureHeight[index] = buffers.height[index] ?? 0;
}

function campTileAt(dx: number, dy: number): number {
  const onEdge = Math.abs(dx) === LANDMARK_HALF || Math.abs(dy) === LANDMARK_HALF;
  if (onEdge) {
    const isGate = Math.abs(dy) === LANDMARK_HALF && (dx === 0 || dx === 1);
    return isGate ? TILE.Floor : TILE.CampFence;
  }
  return dy === -2 && Math.abs(dx) === 2 ? TILE.CampTent : TILE.Floor;
}

const RUIN_PILLAR_OFFSETS = new Set([
  "-3,-3", "3,-3", "-3,3", "3,3", "-2,-3", "2,-3", "-3,0", "3,0", "-2,3", "2,3", "-2,-2", "2,-2",
]);

function ruinTileAt(dx: number, dy: number): number {
  return RUIN_PILLAR_OFFSETS.has(`${dx},${dy}`) ? TILE.RuinPillar : TILE.Floor;
}
