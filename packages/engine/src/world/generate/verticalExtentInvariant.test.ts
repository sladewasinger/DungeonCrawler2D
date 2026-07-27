// Multi-seed generator invariant (docs/VISUAL_DIRECTION.md's z+1 vertical-extent
// rule, ROADMAP.md Epic 7.7): every generated chunk, across many seeds/floors/
// coordinates, must have zero raised regions shallower than their height demands.
// Independently re-derives the check (not a call into verticalExtent.ts's fix
// passes) so a regression in either the fix or this test can't hide the other's bug.
import { describe, expect, it } from "vitest";
import { WALL_FACE_MIN_DROP } from "../../core/constants.js";
import { CHUNK_SIZE, TILE, TOPOLOGY } from "../types.js";
import { generateChunk } from "./index.js";

interface Violation {
  readonly x: number;
  readonly y: number;
  readonly kind: "wall" | "floor";
  readonly z: number;
  readonly depth: number;
}

/** Last row (inclusive) of the run starting at (x, y0) — TOPOLOGY.Uncarved rows if `wantWall`, else same-height floor rows. */
interface ScanInput { readonly tiles: Uint8Array; readonly height: Float32Array; readonly x: number; readonly y: number; }

function runEnd(input: ScanInput & { readonly wantWall: boolean }): number {
  const h0 = heightAt(input, input.y);
  let y2 = input.y;
  while (y2 + 1 < CHUNK_SIZE) {
    if (!continuesRun({ ...input, y: y2 + 1, h0 })) break;
    y2++;
  }
  return y2;
}

function continuesRun(input: ScanInput & { readonly wantWall: boolean; readonly h0: number }): boolean {
  const tile = tileAt(input, input.y);
  if (input.wantWall) return tile === TOPOLOGY.Uncarved;
  return tile !== TOPOLOGY.Uncarved && tile !== TILE.Stairs && Math.abs(heightAt(input, input.y) - input.h0) <= 0.01;
}

/** A TOPOLOGY.Uncarved run shallower than z+1 (z=1), open to real floor on both its north and south. */
function wallRunViolation(input: ScanInput): Violation | null {
  const y2 = runEnd({ ...input, wantWall: true });
  const depth = y2 - input.y + 1;
  if (depth < 2 && openOnBothSides({ ...input, y2 })) return { x: input.x, y: input.y, kind: "wall", z: 1, depth };
  return null;
}

/** A same-height FLOOR run shallower than z+1, where z is its own height and it drops to open ground south. */
function floorRunViolation(input: ScanInput): Violation | null {
  const h0 = heightAt(input, input.y);
  const y2 = runEnd({ ...input, wantWall: false });
  if (y2 >= CHUNK_SIZE - 1) return null; // chunk-edge truncated: true depth unknown
  const southT = tileAt(input, y2 + 1);
  const southH = heightAt(input, y2 + 1);
  const dropsToOpen = southT === TILE.Floor && h0 - southH >= WALL_FACE_MIN_DROP;
  const depth = y2 - input.y + 1;
  const z = Math.round(h0);
  if (dropsToOpen && depth < z + 1) return { x: input.x, y: input.y, kind: "floor", z, depth };
  return null;
}

/** True when (x, y) can start a floor-plateau run worth checking: real floor, a whole-number height >= 1. */
function startsFloorPlateau(input: ScanInput): boolean {
  const t = tileAt(input, input.y);
  const h = heightAt(input, input.y);
  const rounded = Math.round(h);
  return t === TILE.Floor && rounded >= 1 && Math.abs(h - rounded) <= 0.01;
}

function scanColumn(tiles: Uint8Array, height: Float32Array, x: number): Violation[] {
  const found: Violation[] = [];
  let y = 0;
  while (y < CHUNK_SIZE) {
    const scan = scanRunAt({ tiles, height, x, y });
    if (scan.violation) found.push(scan.violation);
    y = scan.nextY;
  }
  return found;
}

function scanRunAt(input: ScanInput): { readonly violation: Violation | null; readonly nextY: number } {
  const wantWall = tileAt(input, input.y) === TOPOLOGY.Uncarved;
  if (!wantWall && !startsFloorPlateau(input)) return { violation: null, nextY: input.y + 1 };
  const violation = wantWall ? wallRunViolation(input) : floorRunViolation(input);
  return { violation, nextY: runEnd({ ...input, wantWall }) + 1 };
}

function tileAt(input: ScanInput, y: number): number { return input.tiles[y * CHUNK_SIZE + input.x] ?? TOPOLOGY.Uncarved; }
function heightAt(input: ScanInput, y: number): number { return input.height[y * CHUNK_SIZE + input.x] ?? 0; }
function openOnBothSides(input: ScanInput & { readonly y2: number }): boolean { return input.y > 0 && input.y2 < CHUNK_SIZE - 1 && tileAt(input, input.y - 1) !== TOPOLOGY.Uncarved && tileAt(input, input.y2 + 1) !== TOPOLOGY.Uncarved; }

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
  it("zero shallow raised regions across many seeds, floors, and chunk coordinates", { timeout: 120_000 }, () => {
    const violations = collectViolations();
    if (violations.length > 0) reportViolations(violations);
    expect(violations).toHaveLength(0);
  });
});

interface LocatedViolation { readonly seed: number; readonly floor: number; readonly cx: number; readonly cy: number; readonly v: Violation; }
function collectViolations(): LocatedViolation[] {
  return testCoordinates().flatMap(scanGeneratedChunk);
}
function testCoordinates(): Array<{ seed: number; floor: number; cx: number; cy: number }> {
  const coordinates: Array<{ seed: number; floor: number; cx: number; cy: number }> = [];
  for (let seed = 1; seed <= 20; seed++) for (let floor = 0; floor <= 1; floor++) addChunkCoordinates(coordinates, seed, floor);
  return coordinates;
}
function addChunkCoordinates(coordinates: Array<{ seed: number; floor: number; cx: number; cy: number }>, seed: number, floor: number): void {
  for (let cx = -5; cx <= 5; cx++) for (let cy = -5; cy <= 5; cy++) coordinates.push({ seed, floor, cx, cy });
}
function scanGeneratedChunk(coordinate: { seed: number; floor: number; cx: number; cy: number }): LocatedViolation[] {
  const chunk = generateChunk({ worldSeed: coordinate.seed * 7919 + 13, floor: coordinate.floor, cx: coordinate.cx, cy: coordinate.cy });
  return scanChunk(chunk.tiles, chunk.height).map((v) => ({ ...coordinate, v }));
}
