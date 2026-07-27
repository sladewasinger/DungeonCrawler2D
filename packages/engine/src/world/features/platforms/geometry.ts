import { hash2D, mixSeeds } from "../../../core/rng.js";
import { generatedChunkCenter, type Seeds } from "../../terrain.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../../generate/scale.js";
import type { WorldChunkCoordinate } from "../platforms.js";

export const PLATFORM_TIER_STEP = 1;

export interface LocalPoint {
  lx: number;
  ly: number;
}

export interface Mesa {
  dx: number;
  dy: number;
  hx: number;
  hy: number;
  tier: 1 | 2;
}

const DIAGONALS: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const TIER2_SHELL_WIDTH = 2;

export function clusterCenter(chunk: WorldChunkCoordinate, seeds: Seeds, reach: number): LocalPoint {
  const junction = generatedChunkCenter(chunk.worldSeed, chunk.floor, chunk.cx, chunk.cy);
  const [dx, dy] = DIAGONALS[hash2D(mixSeeds(seeds.layout, 0x9e5b), chunk.cx, chunk.cy) % DIAGONALS.length] ?? [1, 1];
  return {
    lx: clamp(junction.x - chunk.cx * CHUNK_SIZE + dx * 8, reach),
    ly: clamp(junction.y - chunk.cy * CHUNK_SIZE + dy * 8, reach),
  };
}

function clamp(value: number, reach: number): number {
  return Math.max(reach, Math.min(CHUNK_SIZE - 1 - reach, Math.round(value)));
}

export function mesasFor(seeds: Seeds, cx: number, cy: number): Mesa[] {
  const hash = (salt: number) => hash2D(mixSeeds(seeds.layout, 0x9e60, salt), cx, cy);
  const count = 3 + (hash(0) % 3);
  return [centralMesa(), ...outerMesas(count, hash)];
}

function centralMesa(): Mesa {
  return { dx: 0, dy: 0, hx: 3, hy: 3, tier: 2 };
}

function outerMesas(count: number, hash: (salt: number) => number): Mesa[] {
  const mesas: Mesa[] = [];
  for (let index = 1; index < count; index++) mesas.push(outerMesa(index, hash));
  return mesas;
}

function outerMesa(index: number, hash: (salt: number) => number): Mesa {
  const angle = ((hash(index * 3 + 1) % 8) / 8) * Math.PI * 2;
  const distance = 5 + (hash(index * 3 + 2) % 2);
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    hx: 1 + (hash(index * 3 + 3) % 2),
    hy: 1 + (hash(index * 3 + 4) % 2),
    tier: 1,
  };
}

export function mesaRiseAt(mesas: Mesa[], offsetX: number, offsetY: number): number {
  return mesas.reduce((rise, mesa) => Math.max(rise, mesaTierAt(mesa, offsetX, offsetY) * PLATFORM_TIER_STEP), 0);
}

function mesaTierAt(mesa: Mesa, offsetX: number, offsetY: number): number {
  const offset = { lx: offsetX, ly: offsetY };
  if (!contains(mesa, offset, 0)) return 0;
  return mesa.tier === 2 && contains(mesa, offset, TIER2_SHELL_WIDTH) ? 2 : 1;
}

function contains(mesa: Mesa, offset: LocalPoint, inset: number): boolean {
  return Math.abs(offset.lx - mesa.dx) <= mesa.hx - inset && Math.abs(offset.ly - mesa.dy) <= mesa.hy - inset;
}
