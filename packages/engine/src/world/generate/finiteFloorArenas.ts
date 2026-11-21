import { hash2D } from "../../core/rng.js";
import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../core/types.js";
import { bossArenaPlacementAtChunk } from "../features/bossArena/bossArena.js";
import { pickRingChunkFrom } from "../features/descent/descentShared.js";
import { carveAt, forEachRect, localIndex, protectRect, stampFeature, stampSolid } from "./finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type GeneratedBossArena, type GeneratedMiniBossArena, type GeneratedMiniBossGate } from "./finiteFloorTypes.js";

export function placeMiniBossArenas(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly floor: number; readonly seed: number }): GeneratedMiniBossArena[] {
  if (input.floor < 1 || input.floor >= 5) return [];
  const slots = [0, 1, 2, 3];
  return slots.map((slot) => makeMiniBossArena({ ...input, slot }));
}

export function restampMiniBossArena(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly arena: GeneratedMiniBossArena }): void {
  const gate = input.arena.gates[0];
  if (!gate) return;
  stampArena({ buffers: input.buffers, floorBounds: input.bounds, arenaBounds: input.arena.bounds, gate, semantic: FLOOR_SEMANTIC.MiniBossArena });
  for (const platform of input.arena.platforms) stampPlatform({ buffers: input.buffers, bounds: input.bounds, platform });
}

function makeMiniBossArena(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly floor: number; readonly seed: number; readonly slot: number }): GeneratedMiniBossArena {
  const chunks = [{ cx: -2, cy: 1 }, { cx: 2, cy: -2 }, { cx: -4, cy: -3 }, { cx: 5, cy: 5 }];
  const chunk = chunks[input.slot] ?? { cx: -2, cy: 1 };
  const center = { x: chunk.cx * 32 + 16, y: chunk.cy * 32 + 16 };
  const bounds = { x0: center.x - 6, y0: center.y - 6, x1: center.x + 6, y1: center.y + 6 };
  const interior = { x0: bounds.x0 + 1, y0: bounds.y0 + 1, x1: bounds.x1 - 1, y1: bounds.y1 - 1 };
  const gate = arenaGate(bounds, hash2D(input.seed, input.floor, input.slot));
  stampArena({ buffers: input.buffers, floorBounds: input.bounds, arenaBounds: bounds, gate, semantic: FLOOR_SEMANTIC.MiniBossArena });
  const platforms = [{ x: center.x - 3, y: center.y, height: 1, screenDepthTiles: 2 }, { x: center.x + 3, y: center.y, height: 1, screenDepthTiles: 2 }];
  for (const platform of platforms) stampPlatform({ ...input, platform });
  protectRect({ buffers: input.buffers, bounds: input.bounds, rect: bounds });
  return { id: `mini-boss-arena-${input.floor}-${input.slot}`, kind: "mini-boss-arena", key: `${input.floor}:${chunk.cx},${chunk.cy}`, chunk, bounds, interior, center, gates: [gate], platforms, ports: [{ x: Math.floor(gate.outside.x), y: Math.floor(gate.outside.y) }], protectedCells: [center, { x: gate.x, y: gate.y }], position: center };
}

function arenaGate(bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }, roll: number): GeneratedMiniBossGate {
  const centerX = Math.floor((bounds.x0 + bounds.x1) / 2);
  const centerY = Math.floor((bounds.y0 + bounds.y1) / 2);
  if (roll % 4 === 0) return gate({ x: centerX, y: bounds.y0, featureFace: FEATURE_FACE.North, inside: { x: centerX, y: bounds.y0 + 1 }, outside: { x: centerX, y: bounds.y0 - 1 } });
  if (roll % 4 === 1) return gate({ x: bounds.x1, y: centerY, featureFace: FEATURE_FACE.East, inside: { x: bounds.x1 - 1, y: centerY }, outside: { x: bounds.x1 + 1, y: centerY } });
  if (roll % 4 === 2) return gate({ x: centerX, y: bounds.y1, featureFace: FEATURE_FACE.South, inside: { x: centerX, y: bounds.y1 - 1 }, outside: { x: centerX, y: bounds.y1 + 1 } });
  return gate({ x: bounds.x0, y: centerY, featureFace: FEATURE_FACE.West, inside: { x: bounds.x0 + 1, y: centerY }, outside: { x: bounds.x0 - 1, y: centerY } });
}

function gate(input: GeneratedMiniBossGate): GeneratedMiniBossGate {
  return { ...input, inside: { x: input.inside.x + 0.5, y: input.inside.y + 0.5 }, outside: { x: input.outside.x + 0.5, y: input.outside.y + 0.5 } };
}

function stampArena(input: { readonly buffers: FloorBuffers; readonly floorBounds: FloorBounds; readonly arenaBounds: { x0: number; y0: number; x1: number; y1: number }; readonly gate: GeneratedMiniBossGate; readonly semantic: number }): void {
  for (let y = input.arenaBounds.y0; y <= input.arenaBounds.y1; y++) {
    for (let x = input.arenaBounds.x0; x <= input.arenaBounds.x1; x++) {
      stampArenaCell({ ...input, x, y });
    }
  }
  stampFeature({ buffers: input.buffers, bounds: input.floorBounds, x: input.gate.x, y: input.gate.y, tile: TILE.ArenaGate, face: input.gate.featureFace, height: 1 });
}

function stampArenaCell(input: { readonly buffers: FloorBuffers; readonly floorBounds: FloorBounds; readonly arenaBounds: { x0: number; y0: number; x1: number; y1: number }; readonly gate: GeneratedMiniBossGate; readonly semantic: number; readonly x: number; readonly y: number }): void {
  const ring = input.x === input.arenaBounds.x0 || input.x === input.arenaBounds.x1 || input.y === input.arenaBounds.y0 || input.y === input.arenaBounds.y1;
  const gate = input.x === input.gate.x && input.y === input.gate.y;
  if (ring && !gate) {
    stampSolid({ buffers: input.buffers, bounds: input.floorBounds, x: input.x, y: input.y });
    input.buffers.semantic[localIndex({ bounds: input.floorBounds, x: input.x, y: input.y })] = input.semantic;
  }
  else carveAt({ buffers: input.buffers, bounds: input.floorBounds, point: { x: input.x, y: input.y }, semantic: input.semantic, regionId: 1 });
}

function stampPlatform(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly platform: { readonly x: number; readonly y: number; readonly height: number } }): void {
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x: input.platform.x, y: input.platform.y }, semantic: FLOOR_SEMANTIC.MiniBossArena, regionId: 1 });
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x: input.platform.x, y: input.platform.y + 1 }, semantic: FLOOR_SEMANTIC.MiniBossArena, regionId: 1 });
  if (input.platform.x < input.bounds.minX || input.platform.x > input.bounds.maxX) return;
  if (input.platform.y < input.bounds.minY || input.platform.y + 1 > input.bounds.maxY) return;
  input.buffers.height[localIndex({ bounds: input.bounds, x: input.platform.x, y: input.platform.y })] = input.platform.height;
  input.buffers.height[localIndex({ bounds: input.bounds, x: input.platform.x, y: input.platform.y + 1 })] = input.platform.height;
}

export function bossArenaForBounds(input: {
  readonly bounds: FloorBounds;
  readonly floor: number;
  readonly seed: number;
  readonly isReserved?: (chunk: { readonly cx: number; readonly cy: number }) => boolean;
}): GeneratedBossArena | null {
  if (input.floor !== 5) return null;
  const chunk = pickRingChunkFrom({
    world: { worldSeed: input.seed, floor: input.floor },
    selection: { salt: 0xde5e, radius: 2 },
    isReserved: input.isReserved ?? (() => false),
  });
  const placement = bossArenaPlacementAtChunk({ worldSeed: input.seed, floor: input.floor }, chunk);
  const center = placement.spawn;
  const bounds = { x0: center.x - 7, y0: center.y - 7, x1: center.x + 7, y1: center.y + 7 };
  const gate = placement.gate;
  return { id: "boss-arena", kind: "boss-arena", bounds, center, gate, ports: [{ x: gate.x, y: gate.y + 1 }], protectedCells: [center, gate], position: center };
}

export function placeBossArena(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly floor: number; readonly seed: number }): GeneratedBossArena | null {
  const arena = bossArenaForBounds({
    ...input,
    isReserved: (chunk) => protectedChunk({ buffers: input.buffers, bounds: input.bounds, chunk }),
  });
  if (!arena) return null;
  restampBossArena({ buffers: input.buffers, bounds: input.bounds, arena });
  protectRect({ buffers: input.buffers, bounds: input.bounds, rect: arena.bounds });
  return arena;
}

function protectedChunk(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly chunk: { readonly cx: number; readonly cy: number };
}): boolean {
  const x0 = input.chunk.cx * CHUNK_SIZE;
  const y0 = input.chunk.cy * CHUNK_SIZE;
  const xStart = Math.max(x0, input.bounds.minX);
  const xEnd = Math.min(x0 + CHUNK_SIZE - 1, input.bounds.maxX);
  const yStart = Math.max(y0, input.bounds.minY);
  const yEnd = Math.min(y0 + CHUNK_SIZE - 1, input.bounds.maxY);
  for (let y = yStart; y <= yEnd; y++) {
    if (protectedRow({ ...input, y, xStart, xEnd })) return true;
  }
  return false;
}

function protectedRow(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly y: number;
  readonly xStart: number;
  readonly xEnd: number;
}): boolean {
  for (let x = input.xStart; x <= input.xEnd; x++) {
    if (input.buffers.protectedCells[localIndex({ bounds: input.bounds, x, y: input.y })] === 1) return true;
  }
  return false;
}

export function restampBossArena(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly arena: GeneratedBossArena }): void {
  forEachRect(input.arena.bounds, (x, y) => stampBossArenaCell({ ...input, x, y }));
  stampFeature({ buffers: input.buffers, bounds: input.bounds, x: input.arena.gate.x, y: input.arena.gate.y, tile: TILE.ArenaGate, face: FEATURE_FACE.South, height: 1, semantic: FLOOR_SEMANTIC.BossArena });
}

function stampBossArenaCell(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly arena: GeneratedBossArena; readonly x: number; readonly y: number }): void {
  const half = Math.floor((input.arena.bounds.x1 - input.arena.bounds.x0) / 2);
  const innerEdge = half - 1;
  const dx = input.x - input.arena.center.x;
  const dy = input.y - input.arena.center.y;
  const ring = Math.max(Math.abs(dx), Math.abs(dy)) >= innerEdge;
  const gate = input.x === input.arena.gate.x && dy >= innerEdge && dy <= half;
  if (ring && !gate) {
    stampSolid({ buffers: input.buffers, bounds: input.bounds, x: input.x, y: input.y });
    input.buffers.semantic[localIndex({ bounds: input.bounds, x: input.x, y: input.y })] = FLOOR_SEMANTIC.BossArena;
  }
  else carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x: input.x, y: input.y }, semantic: FLOOR_SEMANTIC.BossArena, regionId: 1 });
}
