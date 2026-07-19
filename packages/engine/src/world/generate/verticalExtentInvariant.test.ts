// Multi-seed generator invariant (docs/VISUAL_DIRECTION.md's z+1 vertical-extent
// rule, ROADMAP.md Epic 7.7): every generated chunk, across many seeds/floors/
// coordinates, must have zero raised regions shallower than their height demands.
// Independently re-derives the check (not a call into verticalExtent.ts's fix
// passes) so a regression in either the fix or this test can't hide the other's bug.
import { describe, expect, it } from "vitest";
import { WALL_FACE_MIN_DROP } from "../../core/constants.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateChunk } from "./index.js";

interface Violation {
  readonly x: number;
  readonly y: number;
  readonly kind: "wall" | "floor";
  readonly z: number;
  readonly depth: number;
}

/** Last row (inclusive) of the run starting at (x, y0) — TILE.Wall rows if `wantWall`, else same-height floor rows. */
function runEnd(tiles: Uint8Array, height: Float32Array, x: number, y0: number, wantWall: boolean): number {
  const h0 = height[y0 * CHUNK_SIZE + x] ?? 0;
  let y2 = y0;
  while (y2 + 1 < CHUNK_SIZE) {
    const t = tiles[(y2 + 1) * CHUNK_SIZE + x];
    if (wantWall ? t !== TILE.Wall : t === TILE.Wall || t === TILE.Stairs) break;
    if (!wantWall && Math.abs((height[(y2 + 1) * CHUNK_SIZE + x] ?? 0) - h0) > 0.01) break;
    y2++;
  }
  return y2;
}

/** A TILE.Wall run shallower than z+1 (z=1), open to real floor on both its north and south. */
function wallRunViolation(tiles: Uint8Array, height: Float32Array, x: number, y0: number): Violation | null {
  const y2 = runEnd(tiles, height, x, y0, true);
  const northOpen = y0 > 0 && tiles[(y0 - 1) * CHUNK_SIZE + x] !== TILE.Wall;
  const southOpen = y2 < CHUNK_SIZE - 1 && tiles[(y2 + 1) * CHUNK_SIZE + x] !== TILE.Wall;
  const depth = y2 - y0 + 1;
  if (depth < 2 && northOpen && southOpen) return { x, y: y0, kind: "wall", z: 1, depth };
  return null;
}

/** A same-height FLOOR run shallower than z+1, where z is its own height and it drops to open ground south. */
function floorRunViolation(tiles: Uint8Array, height: Float32Array, x: number, y0: number): Violation | null {
  const h0 = height[y0 * CHUNK_SIZE + x] ?? 0;
  const y2 = runEnd(tiles, height, x, y0, false);
  if (y2 >= CHUNK_SIZE - 1) return null; // chunk-edge truncated: true depth unknown
  const southT = tiles[(y2 + 1) * CHUNK_SIZE + x];
  const southH = height[(y2 + 1) * CHUNK_SIZE + x] ?? 0;
  const dropsToOpen = southT === TILE.Floor && h0 - southH >= WALL_FACE_MIN_DROP;
  const depth = y2 - y0 + 1;
  const z = Math.round(h0);
  if (dropsToOpen && depth < z + 1) return { x, y: y0, kind: "floor", z, depth };
  return null;
}

/** True when (x, y) can start a floor-plateau run worth checking: real floor, a whole-number height >= 1. */
function startsFloorPlateau(tiles: Uint8Array, height: Float32Array, x: number, y: number): boolean {
  const t = tiles[y * CHUNK_SIZE + x];
  const h = height[y * CHUNK_SIZE + x] ?? 0;
  const rounded = Math.round(h);
  return t === TILE.Floor && rounded >= 1 && Math.abs(h - rounded) <= 0.01;
}

function scanColumn(tiles: Uint8Array, height: Float32Array, x: number): Violation[] {
  const found: Violation[] = [];
  let y = 0;
  while (y < CHUNK_SIZE) {
    const isWall = tiles[y * CHUNK_SIZE + x] === TILE.Wall;
    const isPlateauStart = !isWall && startsFloorPlateau(tiles, height, x, y);
    if (!isWall && !isPlateauStart) {
      y++;
      continue;
    }
    const v = isWall ? wallRunViolation(tiles, height, x, y) : floorRunViolation(tiles, height, x, y);
    if (v) found.push(v);
    y = runEnd(tiles, height, x, y, isWall) + 1;
  }
  return found;
}

function scanChunk(tiles: Uint8Array, height: Float32Array): Violation[] {
  const found: Violation[] = [];
  for (let x = 0; x < CHUNK_SIZE; x++) found.push(...scanColumn(tiles, height, x));
  return found;
}

function reportViolations(violations: Array<{ seed: number; floor: number; cx: number; cy: number; v: Violation }>): void {
  const sample = violations
    .slice(0, 10)
    .map((e) => `seed=${e.seed} floor=${e.floor} chunk=(${e.cx},${e.cy}) ${JSON.stringify(e.v)}`)
    .join("\n");
  throw new Error(`${violations.length} vertical-extent violations found. First 10:\n${sample}`);
}

describe("generator vertical-extent invariant", () => {
  it("zero shallow raised regions across many seeds, floors, and chunk coordinates", () => {
    const violations: Array<{ seed: number; floor: number; cx: number; cy: number; v: Violation }> = [];
    for (let seed = 1; seed <= 20; seed++) {
      for (let floor = 0; floor <= 1; floor++) {
        for (let cx = -5; cx <= 5; cx++) {
          for (let cy = -5; cy <= 5; cy++) {
            const chunk = generateChunk(seed * 7919 + 13, floor, cx, cy);
            for (const v of scanChunk(chunk.tiles, chunk.height)) violations.push({ seed, floor, cx, cy, v });
          }
        }
      }
    }
    if (violations.length > 0) reportViolations(violations);
    expect(violations).toHaveLength(0);
  });
});
