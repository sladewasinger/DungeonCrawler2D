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
    expect(luminance(heightTint(2))).toBeGreaterThan(luminance(heightTint(0)));
  });

  it("clamps at the dais endpoint", () => {
    expect(heightTint(2)).toBe(heightTint(6));
  });

  it("darkens progressively toward the pit floor", () => {
    const surface = luminance(heightTint(0));
    const shallow = luminance(heightTint(-1));
    const deep = luminance(heightTint(-2));
    expect(shallow).toBeLessThan(surface);
    expect(deep).toBeLessThan(shallow);
  });

  it("goes near-black at chasm depth", () => {
    expect(heightTint(-4)).toBe(CHASM_TINT);
    expect(heightTint(-3)).toBe(CHASM_TINT);
  });
});

describe("isChasmDepth", () => {
  it("is true only at/below the chasm threshold", () => {
    expect(isChasmDepth(-3)).toBe(true);
    expect(isChasmDepth(-2.9)).toBe(false);
    expect(isChasmDepth(0)).toBe(false);
  });
});
