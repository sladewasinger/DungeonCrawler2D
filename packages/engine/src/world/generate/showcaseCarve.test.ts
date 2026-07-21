// Unit half of the showcase suite (see showcase.test.ts's module doc): drives
// applyShowcase directly against synthetic chunks with hand-derived carve
// expectations — first-site positions worked out on paper from the closest-
// viable scan order, never read back from the implementation.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { applyShowcase } from "./showcase.js";

describe("applyShowcase (unit)", () => {
  function flatChunk(): { tiles: Uint8Array; height: Float32Array; zones: Uint8Array } {
    return {
      tiles: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor),
      height: new Float32Array(CHUNK_SIZE * CHUNK_SIZE),
      zones: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
    };
  }

  it("is a no-op off floor 1 and off chunk (0,0)", () => {
    const a = flatChunk();
    applyShowcase(1, 2, 0, 0, a.tiles, a.height, a.zones);
    applyShowcase(1, 1, 1, 0, a.tiles, a.height, a.zones);
    const b = flatChunk();
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
  });

  it("carves at hand-derived first sites on an all-flat chunk", () => {
    const g = flatChunk();
    applyShowcase(1, 1, 0, 0, g.tiles, g.height, g.zones);
    const h = (x: number, y: number): number => g.height[y * CHUNK_SIZE + x] ?? 0;
    const t = (x: number, y: number): number => g.tiles[y * CHUNK_SIZE + x] ?? 0;
    // Platform: first 4x4 site is (0,0)..(3,3) -> raised 2x2 at (1,1)..(2,2).
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ] as const) {
      expect(h(x, y), `platform cell ${x},${y}`).toBe(1);
      expect(t(x, y)).toBe(TILE.Floor);
    }
    expect(h(0, 0)).toBe(0); // ring untouched
    expect(h(3, 3)).toBe(0);
    // Pit: first block clear of the fresh platform is (4,1)..(5,2). Its north
    // stair needs a threshold at y=-1 (out of chunk), so the south side wins:
    // tread at (4,3) mid-height, threshold (4,4) kept flat.
    for (const [x, y] of [
      [4, 1],
      [5, 1],
      [4, 2],
      [5, 2],
    ] as const) {
      expect(h(x, y), `pit cell ${x},${y}`).toBe(-1);
      expect(t(x, y)).toBe(TILE.Floor);
    }
    expect(t(4, 3)).toBe(TILE.Stairs);
    expect(h(4, 3)).toBe(-0.5);
    expect(h(4, 4)).toBe(0);
    expect(t(4, 4)).toBe(TILE.Floor);
  });

  it("leaves a chunk untouched when a clean platform and pit already exist in-window", () => {
    const g = flatChunk();
    const set = (x: number, y: number, tile: number, height: number): void => {
      g.tiles[y * CHUNK_SIZE + x] = tile;
      g.height[y * CHUNK_SIZE + x] = height;
    };
    // Natural platform: 2x2 z1 at (10,10)..(11,11), flat open ring.
    for (const [x, y] of [
      [10, 10],
      [11, 10],
      [10, 11],
      [11, 11],
    ] as const) {
      set(x, y, TILE.Floor, 1);
    }
    // Natural pit: 2x2 z-1 at (14,10)..(15,11), rim tread at (14,9).
    for (const [x, y] of [
      [14, 10],
      [15, 10],
      [14, 11],
      [15, 11],
    ] as const) {
      set(x, y, TILE.Floor, -1);
    }
    set(14, 9, TILE.Stairs, -0.5);
    const tilesBefore = Array.from(g.tiles);
    const heightBefore = Array.from(g.height);
    applyShowcase(1, 1, 0, 0, g.tiles, g.height, g.zones);
    expect(Array.from(g.tiles)).toEqual(tilesBefore);
    expect(Array.from(g.height)).toEqual(heightBefore);
  });
});
