// Hand-derived pick tables for pickTallestFirst (docs/ELEVATION-PROJECTION.md section
// 4): expected world cells are computed independently from viewTileToWorld's own
// formula (viewTransform.ts), not by echoing pickTallestFirst's implementation.
//
// Derivation used for each orientation below: pickTallestFirst tries candidate world
// cell = viewTileToWorld({x: vx, y: vy + h}, orientation) for h = MAX..1, accepting the
// first whose heightAt equals h.
//   orientation 0:   world = (vx, vy + h)
//   orientation 90:  world = (-vy - h - 1, vx)
//   orientation 180: world = (-vx - 1, -vy - h - 1)
//   orientation 270: world = (vy + h, -vx - 1)
import { describe, expect, it } from "vitest";
import { pickTallestFirst } from "./picking.js";

function heightMap(entries: Record<string, number>): (wx: number, wy: number) => number {
  return (wx, wy) => entries[`${wx},${wy}`] ?? 0;
}

describe("pickTallestFirst", () => {
  it("falls back to the flat h=0 cell when nothing taller claims the slot (byte-identical to pre-E3 picking)", () => {
    const heightAt = heightMap({});
    expect(pickTallestFirst(2, 2, 0, heightAt)).toEqual({ wx: 2, wy: 2, height: 0 });
    expect(pickTallestFirst(2, 2, 90, heightAt)).toEqual({ wx: -3, wy: 2, height: 0 });
    expect(pickTallestFirst(2, 2, 180, heightAt)).toEqual({ wx: -3, wy: -3, height: 0 });
    expect(pickTallestFirst(2, 2, 270, heightAt)).toEqual({ wx: 2, wy: -3, height: 0 });
  });

  it("orientation 0: a height-2 cell 2 rows south of the raw slot's world home wins over the flat cell", () => {
    // world = (vx, vy + h) = (2, 4) at h=2.
    const heightAt = heightMap({ "2,4": 2, "2,3": 1 });
    expect(pickTallestFirst(2, 2, 0, heightAt)).toEqual({ wx: 2, wy: 4, height: 2 });
  });

  it("orientation 90: world = (-vy-h-1, vx)", () => {
    // h=2 -> (-2-2-1, 2) = (-5, 2); decoy h=1 -> (-4, 2), correctly skipped (tallest-first).
    const heightAt = heightMap({ "-5,2": 2, "-4,2": 1 });
    expect(pickTallestFirst(2, 2, 90, heightAt)).toEqual({ wx: -5, wy: 2, height: 2 });
  });

  it("orientation 180: world = (-vx-1, -vy-h-1)", () => {
    // h=2 -> (-3, -2-2-1) = (-3, -5); decoy h=1 -> (-3, -4).
    const heightAt = heightMap({ "-3,-5": 2, "-3,-4": 1 });
    expect(pickTallestFirst(2, 2, 180, heightAt)).toEqual({ wx: -3, wy: -5, height: 2 });
  });

  it("orientation 270: world = (vy+h, -vx-1)", () => {
    // h=2 -> (2+2, -2-1) = (4, -3); decoy h=1 -> (3, -3).
    const heightAt = heightMap({ "4,-3": 2, "3,-3": 1 });
    expect(pickTallestFirst(2, 2, 270, heightAt)).toEqual({ wx: 4, wy: -3, height: 2 });
  });

  it("prefers the taller of two simultaneously-plausible candidates (tallest-first, not nearest-first)", () => {
    // Both (2,4) at h=2 and (2,3) at h=1 are individually self-consistent (heightAt ==
    // candidate h) — the search must accept the h=2 one since it's tried first.
    const heightAt = heightMap({ "2,4": 2, "2,3": 1 });
    const pick = pickTallestFirst(2, 2, 0, heightAt);
    expect(pick.height).toBe(2);
  });

  it("skips a candidate whose real height doesn't match the search height, falling through to a shorter match", () => {
    // (2,4) exists but is height 1, not 2 — the h=2 probe rejects it; h=1 probe then
    // finds (2,3) at height 1 and accepts.
    const heightAt = heightMap({ "2,4": 1, "2,3": 1 });
    expect(pickTallestFirst(2, 2, 0, heightAt)).toEqual({ wx: 2, wy: 3, height: 1 });
  });
});
