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
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TILE, type Chunk } from "../../core/types.js";
import { generateChunk } from "../index.js";
import { WORLD_GEOMETRY_SCALE } from "../layout/scale.js";

const EPS = 0.01;
const RADIUS = 24 * WORLD_GEOMETRY_SCALE;
const BLOCK_SIZE = 2 * WORLD_GEOMETRY_SCALE;
const SEEDS = Array.from({ length: 10 }, (_, i) => hashString(`showcase-seed-${i}`));

interface Cell { t: number; h: number }
interface CellPosition { chunk: Chunk; x: number; y: number }

interface BlockPosition {
  chunk: Chunk;
  bx: number;
  by: number;
}

function cellAt({ chunk, x, y }: CellPosition): Cell {
  const index = y * CHUNK_SIZE + x;
  return { t: chunk.tiles[index] ?? TILE.Void, h: chunk.height[index] ?? 0 };
}

function ringCells(radius: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) cells.push([dx, dy]);
  }
  return cells.filter(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) === radius);
}

function isNonNegativeCell([dx, dy]: [number, number]): boolean {
  return dx >= 0 && dy >= 0;
}

function isFloorCell(chunk: Chunk, [x, y]: [number, number]): boolean {
  return cellAt({ chunk, x, y }).t !== TILE.Void;
}

/** The entry anchor per spawn.ts's spiral: nearest non-Void cell to (0,0),
 * expanding Chebyshev rings, dy-then-dx order, in-chunk cells only. */
function anchorOf(c: Chunk): { ax: number; ay: number } {
  for (let radius = 0; radius < CHUNK_SIZE; radius++) {
    const anchor = ringCells(radius).filter(isNonNegativeCell).find((cell) => isFloorCell(c, cell));
    if (anchor) return { ax: anchor[0], ay: anchor[1] };
  }
  return { ax: 0, ay: 0 };
}

/** Both block axes' far corners within RADIUS of the anchor. */
function nearAnchor(c: Chunk, bx: number, by: number): boolean {
  const { ax, ay } = anchorOf(c);
  return (
    Math.max(Math.abs(bx - ax), Math.abs(bx + BLOCK_SIZE - 1 - ax)) <= RADIUS &&
    Math.max(Math.abs(by - ay), Math.abs(by + BLOCK_SIZE - 1 - ay)) <= RADIUS
  );
}

/** The cells surrounding one scaled showcase block at (bx, by). */
function ring(bx: number, by: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = by - 1; y <= by + BLOCK_SIZE; y++) out.push(...ringRow({ bx, by, y }));
  return out;
}

function ringRow({ bx, by, y }: { bx: number; by: number; y: number }): Array<[number, number]> {
  return Array.from({ length: BLOCK_SIZE + 2 }, (_, index) => [bx - 1 + index, y] as [number, number])
    .filter(([x]) => outsideBlock({ x, y, bx, by }));
}

function outsideBlock({ x, y, bx, by }: { x: number; y: number; bx: number; by: number }): boolean {
  const outsideX = x < bx || x >= bx + BLOCK_SIZE;
  return outsideX || y < by || y >= by + BLOCK_SIZE;
}

function matchesBlockCell(cell: Cell, height: number): boolean {
  return cell.t === TILE.Floor && Math.abs(cell.h - height) <= EPS;
}

function isBlock({ chunk, bx, by }: BlockPosition, height: number): boolean {
  for (let y = by; y < by + BLOCK_SIZE; y++) {
    if (!isBlockRow({ chunk, bx, y, height })) return false;
  }
  return true;
}

function isBlockRow({ chunk, bx, y, height }: { chunk: Chunk; bx: number; y: number; height: number }): boolean {
  return Array.from({ length: BLOCK_SIZE }, (_, index) => cellAt({ chunk, x: bx + index, y }))
    .every((cell) => matchesBlockCell(cell, height));
}

function blockPositions(chunk: Chunk): BlockPosition[] {
  const blocks: BlockPosition[] = [];
  for (let by = 1; by < CHUNK_SIZE - BLOCK_SIZE; by++) {
    for (let bx = 1; bx < CHUNK_SIZE - BLOCK_SIZE; bx++) blocks.push({ chunk, bx, by });
  }
  return blocks;
}

function hasPlatformRing(block: BlockPosition): boolean {
  return ring(block.bx, block.by).every(([x, y]) => {
    const cell = cellAt({ chunk: block.chunk, x, y });
    return cell.t !== TILE.Void && cell.h <= 0.25 + EPS;
  });
}

/** 2x2 Floor at z1, every ring cell open ground at z <= 0.25 (a 0.75+ drop on all sides). */
function scanPlatform(c: Chunk): { bx: number; by: number } | null {
  const platform = blockPositions(c).find((block) =>
    nearAnchor(c, block.bx, block.by) && isBlock(block, 1) && hasPlatformRing(block),
  );
  if (platform) return { bx: platform.bx, by: platform.by };
  return null;
}

function pitTread(block: BlockPosition): [number, number] | null {
  for (const [x, y] of ring(block.bx, block.by)) {
    const cell = cellAt({ chunk: block.chunk, x, y });
    if (cell.t === TILE.Stairs && cell.h > -1 + EPS && cell.h < -EPS) return [x, y];
  }
  return null;
}

function hasPitRing(block: BlockPosition): boolean {
  return ring(block.bx, block.by).every(([x, y]) => {
    const cell = cellAt({ chunk: block.chunk, x, y });
    return cell.t !== TILE.Void && (cell.t === TILE.Stairs || cell.h >= -0.25 - EPS);
  });
}

/** 2x2 Floor at z-1, open ring, rim near z0 except >= 1 Stairs tread at -0.5. */
function scanPit(c: Chunk): { bx: number; by: number; tread: [number, number] } | null {
  for (const block of blockPositions(c)) {
    if (!nearAnchor(c, block.bx, block.by) || !isBlock(block, -1) || !hasPitRing(block)) continue;
    const tread = pitTread(block);
    if (tread) return { bx: block.bx, by: block.by, tread };
  }
  return null;
}

describe("floor-1 entry elevation showcase", () => {
  it("guarantees a clean 2x2 z1 platform in the entry window across 10 seeds", () => {
    for (const seed of SEEDS) {
      const chunk = generateChunk({ worldSeed: seed, floor: 1, cx: 0, cy: 0 });
      expect(scanPlatform(chunk), `seed ${seed} has no clean platform`).not.toBeNull();
    }
  });

  it("guarantees a clean 2x2 z-1 pit with a climbable rim-stair tread across 10 seeds", () => {
    for (const seed of SEEDS) {
      const chunk = generateChunk({ worldSeed: seed, floor: 1, cx: 0, cy: 0 });
      const pit = scanPit(chunk);
      expect(pit, `seed ${seed} has no clean pit`).not.toBeNull();
      if (!pit) continue;
      // Hand-derived climb axis: the tread at -0.5 must straddle rim (~0) and
      // pit floor (-1) on one axis — strictly higher one side, lower the other —
      // or demoteOrphanedStairs would have (rightly) deleted it.
      const [tx, ty] = pit.tread;
      const neighborHeights = [
        cellAt({ chunk, x: tx + 1, y: ty }).h,
        cellAt({ chunk, x: tx - 1, y: ty }).h,
        cellAt({ chunk, x: tx, y: ty + 1 }).h,
        cellAt({ chunk, x: tx, y: ty - 1 }).h,
      ];
      expect(
        Math.max(...neighborHeights) - Math.min(...neighborHeights),
        `seed ${seed} tread has no climb gradient`,
      ).toBeGreaterThan(0.2);
    }
  });

});
