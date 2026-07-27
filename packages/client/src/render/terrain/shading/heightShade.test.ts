// Headless tests for height-based tint shading — no Phaser involved. Elevation
// reads as RELATIVE light: floor slightly dimmed, raised ground brighter, pits
// darker. Void surfaces use a flat black tile path.
import { describe, expect, it } from "vitest";
import { TILE } from "@dc2d/engine";
import { CHASM_TINT, heightTint, isChasmDepth, isVoidTile, topEdgeHighlightTint, VOID_SURFACE_COLOR } from "./heightShade.js";

function luminance(tint: number): number {
  return ((tint >> 16) & 0xff) + ((tint >> 8) & 0xff) + (tint & 0xff);
}

function channels(tint: number): readonly [number, number, number] {
  return [(tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff];
}

describe("heightTint", () => {
  it("keeps every walkable height on the neutral gray material ramp", () => {
    for (const height of [-1, 0, 1, 2]) {
      const [r, g, b] = channels(heightTint(height));
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("raised ground is brighter than floor level — height reads as relative light", () => {
    expect(luminance(heightTint(1))).toBeGreaterThan(luminance(heightTint(0)));
  });

  it("clamps at the z2 endpoint (multiply tint can't exceed the sprite's own pixels)", () => {
    expect(heightTint(2)).toBe(heightTint(6));
  });

  it("z0/z1/z2 are each a distinct, at-a-glance brightness step (docs/ROADMAP.md's 'single walls' legibility bug: a raised top used to render identical to plain floor once both hit the same clamp)", () => {
    const z0 = luminance(heightTint(0));
    const z1 = luminance(heightTint(1));
    const z2 = luminance(heightTint(2));
    expect(z1).toBeGreaterThan(z0);
    expect(z2).toBeGreaterThan(z1);
  });

  it("darkens progressively toward the pit floor", () => {
    const surface = luminance(heightTint(0));
    const shallow = luminance(heightTint(-0.5));
    const deep = luminance(heightTint(-1));
    expect(shallow).toBeLessThan(surface);
    expect(deep).toBeLessThan(shallow);
  });

  it("keeps the legacy chasm tint dark at void depth", () => {
    expect(heightTint(-2)).toBe(CHASM_TINT);
    expect(heightTint(-1.5)).toBe(CHASM_TINT);
  });

  it("keeps the legacy chasm tint available for non-surface callers", () => {
    const [r, g, b] = [(CHASM_TINT >> 16) & 0xff, (CHASM_TINT >> 8) & 0xff, CHASM_TINT & 0xff];
    expect(r).toBeGreaterThan(20);
    expect(g).toBeGreaterThan(20);
    expect(b).toBeGreaterThan(20);
    expect(luminance(CHASM_TINT)).toBeLessThan(luminance(heightTint(-1))); // still darker than an ordinary pit
  });

  it("a pit floor's own darkening never crushes it below a readable fraction of floor brightness (docs/ROADMAP.md 'pitch black room' repro: austin-dungeon-prod-1 x-13,y18 is an ordinary walkable -1 pit, not a chasm/void, that read as an unrendered hole because this factor never got the same brightness passes AMBIENT did)", () => {
    const floor = luminance(heightTint(0));
    const pit = luminance(heightTint(-1));
    expect(pit).toBeGreaterThan(floor * 0.55);
  });
});

describe("void surface color", () => {
  it("is flat black for every void surface and border", () => {
    expect(VOID_SURFACE_COLOR).toBe(0x000000);
  });
});

describe("isChasmDepth", () => {
  it("is true only at/below the chasm threshold", () => {
    expect(isChasmDepth(-1.5)).toBe(true);
    expect(isChasmDepth(-1.4)).toBe(false);
    expect(isChasmDepth(0)).toBe(false);
  });
});

describe("isVoidTile", () => {
  it("recognizes explicit void identity even when its render height is flat", () => {
    expect(isVoidTile(TILE.Void)).toBe(true);
    expect(isVoidTile(TILE.Floor)).toBe(false);
  });
});

describe("topEdgeHighlightTint", () => {
  it("is a lit rim seam: brighter than the tile's own fill tint at every tier", () => {
    for (const height of [-1, -0.5, 0, 0.5, 1, 2]) {
      expect(luminance(topEdgeHighlightTint(height))).toBeGreaterThan(luminance(heightTint(height)));
    }
  });

  it("still tracks the tier gradient (a z1 seam reads brighter than a z0 seam) — not a single flat highlight color", () => {
    expect(luminance(topEdgeHighlightTint(1))).toBeGreaterThan(luminance(topEdgeHighlightTint(0)));
  });
});
