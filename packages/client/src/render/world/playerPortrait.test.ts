import { DEFAULT_APPEARANCE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { computePortraitCropRect, resolveSentinelPalettes } from "../character/playerCompositor.js";
import { applyRecolorPass, applyUnifiedSelOut, computeSelOutRgb } from "../character/playerRecolor.js";

describe("3D portrait crop and fast in-place recolor/sel-out passes", () => {
  it("recolors sentinel skin, iris, and two-tone hair while preserving neutral armor and transparency", () => {
    const w = 4; const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    const setPx = (x: number, y: number, rgba: readonly [number, number, number, number]): void => {
      const p = (y * w + x) * 4;
      data[p] = rgba[0]; data[p + 1] = rgba[1]; data[p + 2] = rgba[2]; data[p + 3] = rgba[3];
    };
    setPx(0, 0, [255, 0, 140, 255]); // skin highlight
    setPx(1, 0, [0, 200, 220, 255]); // iris base
    setPx(2, 0, [142, 64, 30, 255]); // neutral armor (untouched)
    setPx(0, 1, [40, 210, 0, 255]);  // hair top row (hairT = 0)
    setPx(0, 3, [40, 210, 0, 255]);  // hair bottom row (hairT = 1)
    const pal = resolveSentinelPalettes({ ...DEFAULT_APPEARANCE, hairColor: "pink-purple" });
    applyRecolorPass({ data, width: w, height: h, palettes: pal, cellW: w, cellH: h });

    expect([data[0], data[1], data[2]]).toEqual([...pal.skin.highlight]);
    expect([data[4], data[5], data[6]]).toEqual([...pal.iris.base]);
    expect([data[8], data[9], data[10]]).toEqual([142, 64, 30]);
    expect([data[16], data[17], data[18]]).toEqual([...pal.hair.base]);
    const bot = (3 * w) * 4;
    expect([data[bot], data[bot + 1], data[bot + 2]]).toEqual([...(pal.hairTip?.base ?? [])]);
    const empty = (2 * w + 3) * 4;
    expect([data[empty], data[empty + 1], data[empty + 2], data[empty + 3]]).toEqual([0, 0, 0, 0]);
  });

  it("handles unaligned pixel buffers cleanly in applyRecolorPass", () => {
    const raw = new Uint8ClampedArray(16 + 1);
    const view = raw.subarray(1, 17);
    view[0] = 255; view[1] = 0; view[2] = 140; view[3] = 255;
    const pal = resolveSentinelPalettes(DEFAULT_APPEARANCE);
    applyRecolorPass({ data: view, width: 2, height: 2, palettes: pal });
    expect([view[0], view[1], view[2], view[3]]).toEqual([...pal.skin.highlight, 255]);
  });

  it("adds solid sel-out edges around opaque silhouettes without overwriting interior pixels", () => {
    const sel = new Uint8ClampedArray(5 * 5 * 4);
    const cp = (2 * 5 + 2) * 4;
    sel[cp] = 200; sel[cp + 1] = 100; sel[cp + 2] = 50; sel[cp + 3] = 255;
    applyUnifiedSelOut({ data: sel, width: 5, height: 5, solidRadiusPx: 1 });

    const expectedEdge = [...computeSelOutRgb(200, 100, 50), 255];
    const north = (1 * 5 + 2) * 4;
    expect([sel[north], sel[north + 1], sel[north + 2], sel[north + 3]]).toEqual(expectedEdge);
    expect([sel[cp], sel[cp + 1], sel[cp + 2], sel[cp + 3]]).toEqual([200, 100, 50, 255]);
    expect(sel[3]).toBe(0);
  });

  it("computes consistent 3D portrait crop coordinates from rig metadata", () => {
    expect(computePortraitCropRect({ frameWidth: 192, frameHeight: 192, groundY: 148, scale: 0.2 })).toEqual({
      cw: 107, ch: 137, localX: 42, localY: 24,
    });
  });
});
