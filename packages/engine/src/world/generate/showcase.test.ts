// Elevation showcase invariant (docs/ROADMAP.md PANEL ROUND 3b blocker #3):
// floor-1 chunk (0,0) — the spawn-anchor neighborhood — always contains one
// clean raised 2x2 platform (z1) and one clean 2x2 pit (z-1) with a rim-stair
// tread, within ~20 tiles (Chebyshev <= 24, docs/ASSUMPTIONS.md row 364's
// tolerance) of the entry anchor (the nearest walkable tile to world origin —
// spawn.ts's resolveSpawnAnchor rule). Scan criteria here are re-derived from
// the spec's numbers (0.75 face threshold, +/-1 tiers, -0.5 compact tread),
// independent of showcase.ts's own finder code. The direct applyShowcase unit
// half (synthetic chunks, hand-derived carve sites) lives in
// showcaseCarve.test.ts.
import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE, TILE, type Chunk } from "../types.js";
import { generateChunk } from "./index.js";

const EPS = 0.01;
const RADIUS = 24;
const SEEDS = Array.from({ length: 10 }, (_, i) => hashString(`showcase-seed-${i}`));

interface Cell {
  t: number;
  h: number;
}

function cellAt(tiles: Uint8Array, height: Float32Array, x: number, y: number): Cell {
  return { t: tiles[y * CHUNK_SIZE + x] ?? TILE.Wall, h: height[y * CHUNK_SIZE + x] ?? 0 };
}

/** The entry anchor per spawn.ts's spiral: nearest non-Wall cell to (0,0),
 * expanding Chebyshev rings, dy-then-dx order, in-chunk cells only. */
function anchorOf(c: Chunk): { ax: number; ay: number } {
  for (let radius = 0; radius < CHUNK_SIZE; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius || dx < 0 || dy < 0) continue;
        if (cellAt(c.tiles, c.height, dx, dy).t !== TILE.Wall) return { ax: dx, ay: dy };
      }
    }
  }
  return { ax: 0, ay: 0 };
}

/** Both block axes' far corners within RADIUS of the anchor. */
function nearAnchor(c: Chunk, bx: number, by: number): boolean {
  const { ax, ay } = anchorOf(c);
  return (
    Math.max(Math.abs(bx - ax), Math.abs(bx + 1 - ax)) <= RADIUS &&
    Math.max(Math.abs(by - ay), Math.abs(by + 1 - ay)) <= RADIUS
  );
}

/** The 8 cells surrounding the 2x2 block at (bx, by). */
function ring(bx: number, by: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = by - 1; y <= by + 2; y++) {
    for (let x = bx - 1; x <= bx + 2; x++) {
      if (x < bx || x > bx + 1 || y < by || y > by + 1) out.push([x, y]);
    }
  }
  return out;
}

function isBlock(c: Chunk, bx: number, by: number, h: number): boolean {
  for (let y = by; y <= by + 1; y++) {
    for (let x = bx; x <= bx + 1; x++) {
      const cell = cellAt(c.tiles, c.height, x, y);
      if (cell.t !== TILE.Floor || Math.abs(cell.h - h) > EPS) return false;
    }
  }
  return true;
}

/** 2x2 Floor at z1, every ring cell open ground at z <= 0.25 (a 0.75+ drop on all sides). */
function scanPlatform(c: Chunk): { bx: number; by: number } | null {
  for (let by = 1; by < CHUNK_SIZE - 2; by++) {
    for (let bx = 1; bx < CHUNK_SIZE - 2; bx++) {
      if (!nearAnchor(c, bx, by) || !isBlock(c, bx, by, 1)) continue;
      const ok = ring(bx, by).every(([x, y]) => {
        const cell = cellAt(c.tiles, c.height, x, y);
        return cell.t !== TILE.Wall && cell.h <= 0.25 + EPS;
      });
      if (ok) return { bx, by };
    }
  }
  return null;
}

/** 2x2 Floor at z-1, open ring, rim near z0 except >= 1 Stairs tread at -0.5. */
function scanPit(c: Chunk): { bx: number; by: number; tread: [number, number] } | null {
  for (let by = 1; by < CHUNK_SIZE - 2; by++) {
    for (let bx = 1; bx < CHUNK_SIZE - 2; bx++) {
      if (!nearAnchor(c, bx, by) || !isBlock(c, bx, by, -1)) continue;
      let tread: [number, number] | null = null;
      const ok = ring(bx, by).every(([x, y]) => {
        const cell = cellAt(c.tiles, c.height, x, y);
        if (cell.t === TILE.Wall) return false;
        if (cell.t === TILE.Stairs && Math.abs(cell.h + 0.5) <= EPS) {
          tread = [x, y];
          return true;
        }
        return cell.h >= -0.25 - EPS;
      });
      if (ok && tread) return { bx, by, tread };
    }
  }
  return null;
}

describe("floor-1 entry elevation showcase", () => {
  it("guarantees a clean 2x2 z1 platform in the entry window across 10 seeds", () => {
    for (const seed of SEEDS) {
      const chunk = generateChunk(seed, 1, 0, 0);
      expect(scanPlatform(chunk), `seed ${seed} has no clean platform`).not.toBeNull();
    }
  });

  it("guarantees a clean 2x2 z-1 pit with a climbable rim-stair tread across 10 seeds", () => {
    for (const seed of SEEDS) {
      const chunk = generateChunk(seed, 1, 0, 0);
      const pit = scanPit(chunk);
      expect(pit, `seed ${seed} has no clean pit`).not.toBeNull();
      if (!pit) continue;
      // Hand-derived climb axis: the tread at -0.5 must straddle rim (~0) and
      // pit floor (-1) on one axis — strictly higher one side, lower the other —
      // or demoteOrphanedStairs would have (rightly) deleted it.
      const [tx, ty] = pit.tread;
      const straddles = (
        [
          [1, 0],
          [0, 1],
        ] as const
      ).some(([dx, dy]) => {
        const a = cellAt(chunk.tiles, chunk.height, tx + dx, ty + dy).h;
        const b = cellAt(chunk.tiles, chunk.height, tx - dx, ty - dy).h;
        return (a > -0.5 + EPS && b < -0.5 - EPS) || (b > -0.5 + EPS && a < -0.5 - EPS);
      });
      expect(straddles, `seed ${seed} tread has no climb axis`).toBe(true);
    }
  });

  it("stays byte-deterministic with the showcase pass in the pipeline", () => {
    const seed = SEEDS[0] ?? 1;
    const a = generateChunk(seed, 1, 0, 0);
    const b = generateChunk(seed, 1, 0, 0);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
  });
});
