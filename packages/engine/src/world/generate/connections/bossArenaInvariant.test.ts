// Multi-seed invariants for FLOOR_CAP's sealed boss arena (Epic 7.14,
// docs/ASSUMPTIONS.md #12x): the ring is solid everywhere except its one
// deliberate gate (bossArena.ts's "exactly one gate" contract, checked
// against the FINAL generated chunk — repairCliffs/sealInteriorPockets/
// resolveThinWalls all run after this feature's own stamp, so only the
// generated chunk is a trustworthy geometry source), and the interior is
// still reachable from the wider corridor network through that one gate.
import { describe, expect, it } from "vitest";
import {
  GENERATED_ARENA_HALF,
  GENERATED_RING_THICKNESS,
  bossArenaChunk,
  bossArenaGatePosition,
  bossArenaSpawnAnchor,
} from "../../features/bossArena/bossArena.js";
import { FLOOR_CAP } from "../../features/descent/descentShared.js";
import { STEP_UP } from "../../../core/constants.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { generateChunk } from "../index.js";
import { WORLD_GEOMETRY_SCALE } from "../layout/scale.js";
import { reachesNeighborChunk, type WorldPoint } from "../test-support.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

interface RingCell extends WorldPoint {
  readonly gate: boolean;
}

function arenaOffsets(): Array<{ x: number; y: number }> {
  const width = GENERATED_ARENA_HALF * 2 + 1;
  const inner = GENERATED_ARENA_HALF - GENERATED_RING_THICKNESS + 1;
  return Array.from({ length: width ** 2 }, (_, index) => ({ x: index % width - GENERATED_ARENA_HALF, y: Math.floor(index / width) - GENERATED_ARENA_HALF }))
    .filter(({ x, y }) => {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      return distance >= inner && distance <= GENERATED_ARENA_HALF;
    });
}

function scaledOffsets(): Array<{ x: number; y: number }> {
  return Array.from({ length: WORLD_GEOMETRY_SCALE ** 2 }, (_, index) => ({ x: index % WORLD_GEOMETRY_SCALE, y: Math.floor(index / WORLD_GEOMETRY_SCALE) }));
}

function ringCells(spawn: WorldPoint): RingCell[] {
  const inner = GENERATED_ARENA_HALF - GENERATED_RING_THICKNESS + 1;
  return arenaOffsets().flatMap((offset) => scaledOffsets().map((scale) => ({
    x: spawn.x + offset.x * WORLD_GEOMETRY_SCALE + scale.x,
    y: spawn.y + offset.y * WORLD_GEOMETRY_SCALE + scale.y,
    gate: offset.x === 0 && offset.y >= inner,
  })));
}

function assertRing(seed: number, chunk: { cx: number; cy: number }, spawn: WorldPoint): number {
  const generated = generateChunk({ worldSeed: seed, floor: FLOOR_CAP, ...chunk });
  const cells = ringCells(spawn);
  for (const cell of cells) {
    const index = localIndex(chunk, cell);
    const height = generated.height[index];
    const tile = generated.tiles[index];
    expect(tile, `seed ${seed}: ring cell (${cell.x},${cell.y}) must exist`).toBe(TILE.Floor);
    if (cell.gate) expect(height, `seed ${seed}: gate must be flat`).toBe(0);
    else expect(height, `seed ${seed}: wall ring must be raised`).toBeGreaterThan(STEP_UP);
  }
  return cells.filter((cell) => cell.gate).length;
}

function hasArenaExit(seed: number): boolean {
  const chunk = bossArenaChunk({ worldSeed: seed, floor: FLOOR_CAP });
  const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
  if (!chunk || !spawn) return false;
  const generated = generateChunk({ worldSeed: seed, floor: FLOOR_CAP, ...chunk });
  const index = localIndex(chunk, spawn);
  if (generated.tiles[index] !== TILE.Floor || generated.height[index] !== 0) return false;
  return reachesNeighborChunk({ seed, floor: FLOOR_CAP, cache: new Map() }, spawn);
}

function localIndex(chunk: { cx: number; cy: number }, point: WorldPoint): number {
  const lx = point.x - chunk.cx * CHUNK_SIZE;
  const ly = point.y - chunk.cy * CHUNK_SIZE;
  return ly * CHUNK_SIZE + lx;
}

describe("boss arena: exactly one gate", () => {
  it("every ring cell is raised Floor except the gate's full-thickness notch", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const chunk = bossArenaChunk({ worldSeed: seed, floor: FLOOR_CAP });
      const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
      const gate = bossArenaGatePosition({ worldSeed: seed, floor: FLOOR_CAP });
      expect(chunk).not.toBeNull();
      expect(spawn).not.toBeNull();
      expect(gate).not.toBeNull();
      if (!chunk || !spawn || !gate) continue;
      expect(gate).toEqual({
        x: spawn.x,
        y: spawn.y + GENERATED_ARENA_HALF * WORLD_GEOMETRY_SCALE,
      });

      const floorCount = assertRing(seed, chunk, spawn);
      expect(floorCount, `seed ${seed}: gate notch must preserve its scaled footprint`).toBe(
        GENERATED_RING_THICKNESS * WORLD_GEOMETRY_SCALE ** 2,
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });

  it("the spawn anchor sits inside the ring and reaches the wider corridor network through the gate", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 12)) {
      expect(hasArenaExit(seed), `seed ${seed}: arena interior never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBe(12);
  });
});
