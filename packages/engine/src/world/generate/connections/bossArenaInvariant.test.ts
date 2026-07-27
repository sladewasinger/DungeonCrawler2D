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
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { generateChunk } from "../index.js";
import { WORLD_GEOMETRY_SCALE } from "../layout/scale.js";
import { bfsChunks, keyInChunk, type WorldPoint } from "../test-support.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

function tileAt(seed: number, p: WorldPoint): number {
  const cx = Math.floor(p.x / CHUNK_SIZE);
  const cy = Math.floor(p.y / CHUNK_SIZE);
  const chunk = generateChunk({ worldSeed: seed, floor: FLOOR_CAP, cx: cx, cy: cy });
  const i = (p.y - cy * CHUNK_SIZE) * CHUNK_SIZE + (p.x - cx * CHUNK_SIZE);
  return chunk.tiles[i] ?? TILE.Void;
}

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

function assertRing(seed: number, spawn: WorldPoint): number {
  const cells = ringCells(spawn);
  for (const cell of cells) expect(tileAt(seed, cell), `seed ${seed}: ring cell (${cell.x},${cell.y}) must be Floor`).toBe(TILE.Floor);
  return cells.filter((cell) => cell.gate).length;
}

function hasArenaExit(seed: number): boolean {
  const chunk = bossArenaChunk({ worldSeed: seed, floor: FLOOR_CAP });
  const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
  if (!chunk || !spawn || tileAt(seed, spawn) !== TILE.Floor) return false;
  const reached = bfsChunks({ seed, floor: FLOOR_CAP, cache: new Map() }, spawn, 3);
  return Array.from(reached).some((key) => !keyInChunk(key, chunk));
}

describe("boss arena: exactly one gate", () => {
  it("every ring cell is raised Floor except the gate's full-thickness notch", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
      const gate = bossArenaGatePosition({ worldSeed: seed, floor: FLOOR_CAP });
      expect(spawn).not.toBeNull();
      expect(gate).not.toBeNull();
      if (!spawn || !gate) continue;
      expect(gate).toEqual({
        x: spawn.x,
        y: spawn.y + GENERATED_ARENA_HALF * WORLD_GEOMETRY_SCALE,
      });

      const floorCount = assertRing(seed, spawn);
      expect(floorCount, `seed ${seed}: gate notch must preserve its scaled footprint`).toBe(
        GENERATED_RING_THICKNESS * WORLD_GEOMETRY_SCALE ** 2,
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });

  it("the spawn anchor sits inside the ring and reaches the wider corridor network through the gate", { timeout: 120_000 }, () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 35)) {
      expect(hasArenaExit(seed), `seed ${seed}: arena interior never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });
});
