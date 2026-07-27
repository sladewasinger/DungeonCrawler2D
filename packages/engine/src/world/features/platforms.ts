import { hash2D, mixSeeds } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "./fixed.js";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  seedsFor,
  type CorridorSegment,
  type Seeds,
} from "../terrain.js";
import { TILE } from "../types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE, scaleGeneratedPoint } from "../generate/scale.js";
import { clusterCenter, mesasFor, mesaRiseAt, type LocalPoint, type Mesa } from "./platforms/geometry.js";

const PLATFORM_MODULUS = 4;
const PAD = 8;
const PAD_MARGIN = 2;
const REACH = PAD + PAD_MARGIN;
const CORRIDOR_CLEAR = CORRIDOR_HALF_WIDTH + 1;
export { PLATFORM_TIER_STEP } from "./platforms/geometry.js";

export interface WorldChunkCoordinate {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
}

export interface PlatformApplication {
  chunk: WorldChunkCoordinate;
  seeds: Seeds;
  segs: CorridorSegment[];
  tiles: Uint8Array;
  height: Float32Array;
}

export function hasPlatformCluster(chunk: WorldChunkCoordinate): boolean {
  if (isProvingGround(chunk) || isSafeRoomChunk(chunk) || isStairsChunk(chunk)) return false;
  return hash2D(mixSeeds(seedsFor(chunk.worldSeed, chunk.floor).layout, 0x9e5a), chunk.cx, chunk.cy) % PLATFORM_MODULUS === 0;
}

function isProvingGround({ cx, cy }: WorldChunkCoordinate): boolean {
  return cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1;
}

interface PadStamp {
  input: PlatformApplication;
  center: LocalPoint;
  mesas: Mesa[];
  padHeight: number;
}

function platformHeight(stamp: PadStamp, point: LocalPoint): number {
  const { input, center, mesas, padHeight } = stamp;
  const { cx, cy } = input.chunk;
  const worldX = cx * CHUNK_SIZE + point.lx;
  const worldY = cy * CHUNK_SIZE + point.ly;
  if (distToCorridor(input.segs, worldX, worldY) <= CORRIDOR_CLEAR) return padHeight;
  return padHeight + mesaRiseAt(mesas, point.lx - center.lx, point.ly - center.ly);
}

function stampPadCell(stamp: PadStamp, point: LocalPoint): void {
  const { input, center, padHeight } = stamp;
  const index = point.ly * CHUNK_SIZE + point.lx;
  const distance = Math.max(Math.abs(point.lx - center.lx), Math.abs(point.ly - center.ly));
  if (distance <= PAD) {
    input.tiles[index] = TILE.Floor;
    input.height[index] = platformHeight(stamp, point);
    return;
  }
  const progress = (distance - PAD) / PAD_MARGIN;
  const smooth = progress * progress * (3 - 2 * progress);
  input.height[index] = padHeight + ((input.height[index] ?? 0) - padHeight) * smooth;
}

function stampPad(stamp: PadStamp): void {
  const { center } = stamp;
  for (let ly = center.ly - REACH; ly <= center.ly + REACH; ly++) stampPadRow(stamp, ly);
}

function stampPadRow(stamp: PadStamp, ly: number): void {
  for (let lx = stamp.center.lx - REACH; lx <= stamp.center.lx + REACH; lx++) {
    if (isInChunk(lx, ly)) stampPadCell(stamp, { lx, ly });
  }
}

function isInChunk(lx: number, ly: number): boolean {
  return lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
}

export function applyPlatformCluster(input: PlatformApplication): void {
  if (!hasPlatformCluster(input.chunk)) return;
  const center = clusterCenter(input.chunk, input.seeds, REACH);
  const mesas = mesasFor(input.seeds, input.chunk.cx, input.chunk.cy);
  const { cx, cy } = input.chunk;
  const padHeight = baseSample(input.seeds, input.segs, cx * CHUNK_SIZE + center.lx, cy * CHUNK_SIZE + center.ly).height;
  stampPad({ input, center, mesas, padHeight });
}

function isRaisedMesa(chunk: WorldChunkCoordinate, segs: CorridorSegment[], point: LocalPoint): boolean {
  const x = chunk.cx * CHUNK_SIZE + point.lx;
  const y = chunk.cy * CHUNK_SIZE + point.ly;
  return distToCorridor(segs, x, y) > CORRIDOR_CLEAR;
}

export function platformLootSpots(chunk: WorldChunkCoordinate): Array<{ x: number; y: number }> {
  if (!hasPlatformCluster(chunk)) return [];
  const seeds = seedsFor(chunk.worldSeed, chunk.floor);
  const center = clusterCenter(chunk, seeds, REACH);
  const segs = corridorSegments(chunk.worldSeed, chunk.floor, chunk.cx, chunk.cy);
  return mesasFor(seeds, chunk.cx, chunk.cy)
    .map(({ dx, dy }) => ({ lx: center.lx + dx, ly: center.ly + dy }))
    .filter((point) => point.lx >= 0 && point.ly >= 0 && point.lx < CHUNK_SIZE && point.ly < CHUNK_SIZE)
    .filter((point) => isRaisedMesa(chunk, segs, point))
    .map((point) => scaleGeneratedPoint({ x: chunk.cx * CHUNK_SIZE + point.lx + 0.5, y: chunk.cy * CHUNK_SIZE + point.ly + 0.5 }));
}
