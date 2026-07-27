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
} from "../features/bossArena.js";
import { FLOOR_CAP } from "../features/descentShared.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateChunk } from "./index.js";
import { WORLD_GEOMETRY_SCALE } from "./scale.js";
import { bfsChunks, keyInChunk, type ChunkCache, type WorldPoint } from "./test-support.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

function tileAt(seed: number, p: WorldPoint): number {
  const cx = Math.floor(p.x / CHUNK_SIZE);
  const cy = Math.floor(p.y / CHUNK_SIZE);
  const chunk = generateChunk(seed, FLOOR_CAP, cx, cy);
  const i = (p.y - cy * CHUNK_SIZE) * CHUNK_SIZE + (p.x - cx * CHUNK_SIZE);
  return chunk.tiles[i] ?? TILE.Void;
}

interface RingCell extends WorldPoint {
  readonly gate: boolean;
}

function ringCells(spawn: WorldPoint): RingCell[] {
  const inner = GENERATED_ARENA_HALF - GENERATED_RING_THICKNESS + 1;
  const cells: RingCell[] = [];
  for (let dy = -GENERATED_ARENA_HALF; dy <= GENERATED_ARENA_HALF; dy++) {
    for (let dx = -GENERATED_ARENA_HALF; dx <= GENERATED_ARENA_HALF; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < inner || d > GENERATED_ARENA_HALF) continue;
      const gate = dx === 0 && dy >= inner && dy <= GENERATED_ARENA_HALF;
      for (let oy = 0; oy < WORLD_GEOMETRY_SCALE; oy++) {
        for (let ox = 0; ox < WORLD_GEOMETRY_SCALE; ox++) {
          cells.push({
            x: spawn.x + dx * WORLD_GEOMETRY_SCALE + ox,
            y: spawn.y + dy * WORLD_GEOMETRY_SCALE + oy,
            gate,
          });
        }
      }
    }
  }
  return cells;
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

      let floorCount = 0;
      for (const cell of ringCells(spawn)) {
        const tile = tileAt(seed, cell);
        if (cell.gate) {
          expect(tile, `seed ${seed}: gate notch cell (${cell.x},${cell.y}) must be walkable`).toBe(TILE.Floor);
          floorCount++;
        } else {
          expect(tile, `seed ${seed}: ring cell (${cell.x},${cell.y}) must be finite Floor`).toBe(TILE.Floor);
        }
      }
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
      const chunk = bossArenaChunk(seed, FLOOR_CAP);
      const spawn = bossArenaSpawnAnchor({ worldSeed: seed, floor: FLOOR_CAP });
      expect(chunk).not.toBeNull();
      expect(spawn).not.toBeNull();
      if (!chunk || !spawn) continue;
      expect(tileAt(seed, spawn), `seed ${seed}: spawn anchor itself must be walkable`).toBe(TILE.Floor);

      const cache: ChunkCache = new Map();
      const reached = bfsChunks(seed, FLOOR_CAP, spawn, 3, cache);
      const touchesNeighbor = Array.from(reached).some((key) => !keyInChunk(key, chunk.cx, chunk.cy));
      expect(touchesNeighbor, `seed ${seed}: arena interior never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });
});
