import {
  ARENA_HALF,
  RING_THICKNESS,
  applyBossArenaAtChunk,
  bossArenaPlacementAtChunk,
} from "../../../features/bossArena/bossArena.js";
import { FLOOR_CAP } from "../../../features/descent/descentShared.js";
import { CHUNK_SIZE, TILE, TOPOLOGY, type Chunk } from "../../../core/types.js";
import { expect } from "vitest";
import { generateChunk } from "../../index.js";
import { pickRingChunkFrom } from "../../../features/descent/descentShared.js";
import { bfsChunks, keyInChunk, type WorldPoint } from "../../test-support.js";

export const BOSS_SEEDS = Array.from({ length: 40 }, (_, index) => index * 7919 + 13);
export const REACHABILITY_SEEDS = BOSS_SEEDS.slice(0, 12);

interface RingCell extends WorldPoint { readonly gate: boolean; }

export function assertRingSeed(seed: number): void {
  const placement = legacyPlacement(seed);
  const { chunk, spawn, gate } = placement;
  expect(gate).toEqual({ x: spawn.x, y: spawn.y + ARENA_HALF });

  const generated = compatibilityChunk({ seed, coordinate: chunk });
  const floorCount = ringCells(spawn).filter((cell) => {
    const index = localIndex(chunk, cell);
    const tile = generated.tiles[index];
    const height = generated.height[index];
    if (cell.gate) {
      expect(tile, gateMessage(seed, cell)).toBe(TILE.Floor);
      expect(height, `seed ${seed}: gate must be flat`).toBe(0);
    } else {
      expect(tile, ringMessage(seed, cell)).toBe(TILE.Void);
      expect(height, `seed ${seed}: VOID ring must be heightless`).toBe(0);
    }
    return cell.gate;
  }).length;
  expect(floorCount, `seed ${seed}: gate notch must preserve its footprint`).toBe(RING_THICKNESS);
}

export function assertReachableSeed(seed: number): void {
  const { chunk, spawn } = legacyPlacement(seed);
  const generated = compatibilityChunk({ seed, coordinate: chunk });
  const index = localIndex(chunk, spawn);
  expect(generated.tiles[index]).toBe(TILE.Floor);
  expect(generated.height[index]).toBe(0);
  const reached = bfsChunks({
    seed,
    floor: FLOOR_CAP,
    cache: new Map(),
    chunkFactory: (coordinate) => compatibilityChunk({ seed, coordinate }),
  }, spawn, 1);
  expect([...reached].some((key) => !keyInChunk(key, chunk))).toBe(true);
}

export function assertGeneratedRingSeed(seed: number): void {
  const { chunk, spawn } = legacyPlacement(seed);
  const generated = generateChunk({ worldSeed: seed, floor: FLOOR_CAP, ...chunk });
  const index = localIndex(chunk, spawn);
  expect(generated.tiles[index]).toBe(TILE.Floor);
  expect(generated.height[index]).toBe(0);
}

function legacyPlacement(seed: number): { chunk: { cx: number; cy: number }; spawn: WorldPoint; gate: WorldPoint } {
  const world = { worldSeed: seed, floor: FLOOR_CAP };
  const chunk = pickRingChunkFrom({
    world,
    selection: { salt: 0xde5e, radius: 2 },
    isReserved: () => false,
  });
  const placement = bossArenaPlacementAtChunk(world, chunk);
  return { chunk, spawn: placement.spawn, gate: placement.gate };
}

function compatibilityChunk(input: { seed: number; coordinate: { cx: number; cy: number } }): Chunk {
  const expected = legacyPlacement(input.seed).chunk;
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  const tiles = new Uint8Array(cells).fill(TOPOLOGY.Uncarved);
  const height = new Float32Array(cells);
  const chunk = { worldSeed: input.seed, floor: FLOOR_CAP, ...input.coordinate };
  if (chunk.cx === expected.cx && chunk.cy === expected.cy) {
    const placement = bossArenaPlacementAtChunk({ worldSeed: input.seed, floor: FLOOR_CAP }, expected);
    applyBossArenaAtChunk({ chunk, tiles, height });
    materializeUncarved(tiles);
    carveCompatibilityExit({ tiles, chunk, gate: placement.gate });
  } else {
    tiles.fill(TILE.Floor);
  }
  return {
    ...input.coordinate,
    tiles,
    terrain: new Uint8Array(cells),
    features: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells),
    height,
    zones: new Uint8Array(cells),
  };
}

function materializeUncarved(tiles: Uint8Array): void {
  for (let index = 0; index < tiles.length; index++) {
    if (tiles[index] === TOPOLOGY.Uncarved) tiles[index] = TILE.Void;
  }
}

function carveCompatibilityExit(input: {
  readonly tiles: Uint8Array;
  readonly chunk: { readonly cx: number; readonly cy: number };
  readonly gate: WorldPoint;
}): void {
  const firstY = Math.max(input.gate.y, input.chunk.cy * CHUNK_SIZE);
  const lastY = (input.chunk.cy + 1) * CHUNK_SIZE - 1;
  const localX = input.gate.x - input.chunk.cx * CHUNK_SIZE;
  for (let y = firstY; y <= lastY; y++) {
    const localY = y - input.chunk.cy * CHUNK_SIZE;
    input.tiles[localY * CHUNK_SIZE + localX] = TILE.Floor;
  }
}

function arenaOffsets(): Array<{ x: number; y: number }> {
  const width = ARENA_HALF * 2 + 1;
  const inner = ARENA_HALF - RING_THICKNESS + 1;
  return Array.from({ length: width ** 2 }, (_, index) => ({
    x: index % width - ARENA_HALF,
    y: Math.floor(index / width) - ARENA_HALF,
  })).filter(({ x, y }) => {
    const distance = Math.max(Math.abs(x), Math.abs(y));
    return distance >= inner && distance <= ARENA_HALF;
  });
}

function ringCells(spawn: WorldPoint): RingCell[] {
  const inner = ARENA_HALF - RING_THICKNESS + 1;
  return arenaOffsets().map((offset) => ({
    x: spawn.x + offset.x,
    y: spawn.y + offset.y,
    gate: offset.x === 0 && offset.y >= inner,
  }));
}

function localIndex(chunk: { cx: number; cy: number }, point: WorldPoint): number {
  const lx = point.x - chunk.cx * CHUNK_SIZE;
  const ly = point.y - chunk.cy * CHUNK_SIZE;
  return ly * CHUNK_SIZE + lx;
}

function gateMessage(seed: number, cell: RingCell): string {
  return `seed ${seed}: gate cell (${cell.x},${cell.y}) must be Floor`;
}

function ringMessage(seed: number, cell: RingCell): string {
  return `seed ${seed}: ring cell (${cell.x},${cell.y}) must be VOID`;
}
