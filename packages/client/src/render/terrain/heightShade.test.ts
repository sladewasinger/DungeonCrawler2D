// Headless tests for height-based tint shading — no Phaser involved. Elevation
// reads as RELATIVE light: floor slightly dimmed, raised ground brighter, pits
// darker, chasm near-black. No overlay-rectangle path exists anymore.
import { describe, expect, it } from "vitest";
import { CHASM_TINT, heightTint, isChasmDepth } from "./heightShade.js";

function luminance(tint: number): number {
  return ((tint >> 16) & 0xff) + ((tint >> 8) & 0xff) + (tint & 0xff);
}

describe("heightTint", () => {
  it("raised ground is brighter than floor level — height reads as relative light", () => {
    expect(luminance(heightTint(1))).toBeGreaterThan(luminance(heightTint(0)));
  });

  it("clamps at the dais endpoint", () => {
    expect(heightTint(1)).toBe(heightTint(6));
  });

  it("darkens progressively toward the pit floor", () => {
    const surface = luminance(heightTint(0));
    const shallow = luminance(heightTint(-0.5));
    const deep = luminance(heightTint(-1));
    expect(shallow).toBeLessThan(surface);
    expect(deep).toBeLessThan(shallow);
  });

  it("goes near-black at chasm depth", () => {
    expect(heightTint(-2)).toBe(CHASM_TINT);
    expect(heightTint(-1.5)).toBe(CHASM_TINT);
  });

  it("chasm tint stays dark but isn't crushed to pure black (the 'hole' sprite's own texture must survive the multiply)", () => {
    // Regression: a prior factor (0x30303c) multiplied the hole sprite's
    // already-dark palette down to single-digit channel values — visually
    // indistinguishable from flat black, the pre-deploy "chasm renders
    // pure near-black, no texture" bug. A non-trivial tint (every channel
    // above a visibility floor, but still reading dark) keeps the sprite's
    // cave-mouth shading visible.
    const [r, g, b] = [(CHASM_TINT >> 16) & 0xff, (CHASM_TINT >> 8) & 0xff, CHASM_TINT & 0xff];
    expect(r).toBeGreaterThan(20);
    expect(g).toBeGreaterThan(20);
    expect(b).toBeGreaterThan(20);
    expect(luminance(CHASM_TINT)).toBeLessThan(luminance(heightTint(-1))); // still darker than an ordinary pit
  });
});

describe("isChasmDepth", () => {
  it("is true only at/below the chasm threshold", () => {
    expect(isChasmDepth(-1.5)).toBe(true);
    expect(isChasmDepth(-1.4)).toBe(false);
    expect(isChasmDepth(0)).toBe(false);
  });
});
