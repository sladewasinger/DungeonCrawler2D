// Headless tests for the dynamic-vs-static face-row split (the strip-height perf fix).
import { describe, expect, it } from "vitest";
import { bakesIntoStaticBase, DYNAMIC_FACE_ROWS, stripOverhangTiles } from "./occluderBand.js";
import { MAX_FACE_ROWS } from "./ownFace.js";

describe("bakesIntoStaticBase", () => {
  it("keeps every row of the dynamic band in the occluder strip", () => {
    for (let d = 1; d <= DYNAMIC_FACE_ROWS; d++) {
      expect(bakesIntoStaticBase(d), `distanceToGround ${d}`).toBe(false);
    }
  });

  it("sends every row above the band to the static base sheet", () => {
    for (let d = DYNAMIC_FACE_ROWS + 1; d <= MAX_FACE_ROWS; d++) {
      expect(bakesIntoStaticBase(d), `distanceToGround ${d}`).toBe(true);
    }
  });

  it("splits exactly at the band boundary", () => {
    expect(bakesIntoStaticBase(DYNAMIC_FACE_ROWS)).toBe(false);
    expect(bakesIntoStaticBase(DYNAMIC_FACE_ROWS + 1)).toBe(true);
  });
});

describe("DYNAMIC_FACE_ROWS", () => {
  it("is strictly smaller than MAX_FACE_ROWS — otherwise the split fixes nothing", () => {
    expect(DYNAMIC_FACE_ROWS).toBeLessThan(MAX_FACE_ROWS);
  });

  it("covers an occludable entity's full sprite reach with margin", () => {
    // depthSort.ts: a strip at base row Y occludes feet down to Y + 1 (one row
    // south of the base). Tallest sprite art is 2.25 screen tiles (36px source
    // at x3 over 48px tiles); a jump apex adds ~1.1 tiles of lift
    // (JUMP_VELOCITY^2 / (2 * GRAVITY) = 8.515^2 / 67.8). The band must cover
    // that whole reach measured from one row south of the strip's base.
    const feetRowsSouthOfBase = 1;
    const tallestSpriteTiles = 2.25;
    const jumpApexTiles = 1.1;
    expect(DYNAMIC_FACE_ROWS).toBeGreaterThanOrEqual(
      Math.ceil(feetRowsSouthOfBase + tallestSpriteTiles + jumpApexTiles),
    );
  });
});

describe("stripOverhangTiles", () => {
  it("anchors the ground-adjacent row at the strip's base (overhang 0)", () => {
    expect(stripOverhangTiles(1)).toBe(0);
  });

  it("rises one tile per row up the face", () => {
    for (let d = 1; d <= DYNAMIC_FACE_ROWS; d++) {
      expect(stripOverhangTiles(d)).toBe(d - 1);
    }
  });

  it("never exceeds the band's tallest overhang for dynamic rows", () => {
    expect(stripOverhangTiles(DYNAMIC_FACE_ROWS)).toBe(DYNAMIC_FACE_ROWS - 1);
  });
});
