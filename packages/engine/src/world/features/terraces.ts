import { hash2D, mixSeeds } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "./fixed.js";
import { hasPlatformCluster, type WorldChunkCoordinate } from "./platforms.js";
import { generatedChunkCenter, seedsFor, type CorridorSegment } from "../terrain.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../generate/scale.js";
import { carveTerraceEntries, type TerraceRect } from "./terraces/entries.js";

export const TERRACE_RISE = 1;
const TERRACE_MODULUS = 4;

export interface TerraceSpec {
  lx: number;
  ly: number;
  hx: number;
  hy: number;
}

export interface TerraceApplication {
  chunk: WorldChunkCoordinate;
  segs: CorridorSegment[];
  tiles: Uint8Array;
  height: Float32Array;
}

export function hasTerrace(chunk: WorldChunkCoordinate): boolean {
  if (isProvingGround(chunk) || isSafeRoomChunk(chunk) || isStairsChunk(chunk)) return false;
  if (hasPlatformCluster(chunk)) return false;
  const layout = seedsFor(chunk.worldSeed, chunk.floor).layout;
  return hash2D(mixSeeds(layout, 0x7e44), chunk.cx, chunk.cy) % TERRACE_MODULUS === 0;
}

function isProvingGround({ cx, cy }: WorldChunkCoordinate): boolean {
  return cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1;
}

export function terraceSpec(chunk: WorldChunkCoordinate): TerraceSpec | null {
  if (!hasTerrace(chunk)) return null;
  const hash = terraceHash(chunk);
  const hx = 8 + (hash(1) % 4);
  const hy = 8 + (hash(2) % 4);
  const junction = generatedChunkCenter(chunk.worldSeed, chunk.floor, chunk.cx, chunk.cy);
  return {
    lx: clamp(junction.x - chunk.cx * CHUNK_SIZE, hx),
    ly: clamp(junction.y - chunk.cy * CHUNK_SIZE, hy),
    hx,
    hy,
  };
}

function terraceHash(chunk: WorldChunkCoordinate): (salt: number) => number {
  const layout = seedsFor(chunk.worldSeed, chunk.floor).layout;
  return (salt) => hash2D(mixSeeds(layout, 0x7e50, salt), chunk.cx, chunk.cy);
}

function clamp(value: number, half: number): number {
  return Math.max(half, Math.min(CHUNK_SIZE - 1 - half, Math.round(value)));
}

function terraceRect(spec: TerraceSpec): TerraceRect {
  return { x0: spec.lx - spec.hx, x1: spec.lx + spec.hx, y0: spec.ly - spec.hy, y1: spec.ly + spec.hy };
}

function stampTerraceRect(rect: TerraceRect, height: Float32Array): void {
  for (let ly = rect.y0; ly <= rect.y1; ly++) stampTerraceRow(rect, height, ly);
}

function stampTerraceRow(rect: TerraceRect, height: Float32Array, ly: number): void {
  for (let lx = rect.x0; lx <= rect.x1; lx++) {
    if (lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE) height[ly * CHUNK_SIZE + lx] = TERRACE_RISE;
  }
}

export function applyTerrace(input: TerraceApplication): void {
  const spec = terraceSpec(input.chunk);
  if (!spec) return;
  const rect = terraceRect(spec);
  stampTerraceRect(rect, input.height);
  carveTerraceEntries({ rect, ...input });
}
