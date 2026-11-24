import { DEFAULT_APPEARANCE, type PlayerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import rigMetaJson from "../../../public/assets/player/player-rig.json";
import { resolvePortraitCell } from "../character/playerAssets.js";
import {
  CORE_CLIP_NAMES, MAX_PLAYER_ATLAS_DIM, SECONDARY_CLIP_NAMES, buildTierAtlasPlan, computePortraitCropRect,
  resolveClipTrim, resolveSentinelPalettes, type AtlasFrameSlot,
} from "../character/playerCompositor.js";
import { applyRecolorPass, applyUnifiedSelOut, computeSelOutRgb } from "../character/playerRecolor.js";
import { needsSecondaryAnimTier } from "./playerPoseHelpers.js";

function assertSlotsDisjointWithGutter(slots: readonly AtlasFrameSlot[], gutter = 4): void {
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i]!;
    for (let j = i + 1; j < slots.length; j++) {
      const b = slots[j]!;
      const separatedX = a.dstX + a.w + gutter <= b.dstX || b.dstX + b.w + gutter <= a.dstX;
      const separatedY = a.dstY + a.h + gutter <= b.dstY || b.dstY + b.h + gutter <= a.dstY;
      expect(separatedX || separatedY).toBe(true);
    }
  }
}

function makeSnap(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: "p1", name: "Hero", x: 0, y: 0, elevation: 0, facingX: 0, facingY: 1,
    moving: false, torchLit: false, inWater: false, lastAckSeq: 0, ...overrides,
  };
}

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

  it("handles unaligned pixel buffers and explicit shelf cell rects cleanly in applyRecolorPass", () => {
    const raw = new Uint8ClampedArray(16 + 1);
    const view = raw.subarray(1, 17);
    view[0] = 255; view[1] = 0; view[2] = 140; view[3] = 255;
    const pal = resolveSentinelPalettes(DEFAULT_APPEARANCE);
    applyRecolorPass({ data: view, width: 2, height: 2, palettes: pal });
    expect([view[0], view[1], view[2], view[3]]).toEqual([...pal.skin.highlight, 255]);

    const canvasData = new Uint8ClampedArray(4 * 4 * 4);
    const inside = (1 * 4 + 1) * 4;
    const outside = (3 * 4 + 3) * 4;
    canvasData[inside] = 255; canvasData[inside + 1] = 0; canvasData[inside + 2] = 140; canvasData[inside + 3] = 255;
    canvasData[outside] = 255; canvasData[outside + 1] = 0; canvasData[outside + 2] = 140; canvasData[outside + 3] = 255;
    applyRecolorPass({ data: canvasData, width: 4, height: 4, palettes: pal, cells: [{ x: 1, y: 1, w: 2, h: 2 }] });
    expect([canvasData[inside], canvasData[inside + 1], canvasData[inside + 2]]).toEqual([...pal.skin.highlight]);
    expect([canvasData[outside], canvasData[outside + 1], canvasData[outside + 2]]).toEqual([255, 0, 140]);
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

  it("picks south-east idle cell for portraits and falls back to portraitRow/Col when absent", () => {
    expect(resolvePortraitCell({
      directions: ["south", "se", "side", "ne", "north"],
      clips: { idle: { startRow: 0, frames: 4, fps: 6 } },
      portraitRow: 60,
      portraitCol: 0,
    })).toEqual({ row: 1, col: 0 });

    expect(resolvePortraitCell({
      directions: ["south", "side", "north"],
      clips: {},
      portraitRow: 60,
      portraitCol: 0,
    })).toEqual({ row: 60, col: 0 });
  });

  it("tight-packs trimmed 2-tier player atlases well under 2048px and cuts GPU VRAM over 5x", () => {
    const core = buildTierAtlasPlan(rigMetaJson, CORE_CLIP_NAMES);
    const secondary = buildTierAtlasPlan(rigMetaJson, SECONDARY_CLIP_NAMES);

    expect(core.slots).toHaveLength(125);
    expect(secondary.slots).toHaveLength(115);
    expect(core.width).toBeLessThanOrEqual(2048);
    expect(core.height).toBeLessThanOrEqual(2048);
    expect(secondary.width).toBeLessThanOrEqual(2048);
    expect(secondary.height).toBeLessThanOrEqual(2048);
    expect(core.width * core.height * 4).toBeLessThan(10 * 1024 * 1024);
    expect(secondary.width * secondary.height * 4).toBeLessThan(7 * 1024 * 1024);

    assertSlotsDisjointWithGutter(core.slots);
    assertSlotsDisjointWithGutter(secondary.slots);
    for (const s of [...core.slots, ...secondary.slots]) {
      expect(s.trimX).toBeGreaterThanOrEqual(0);
      expect(s.trimY).toBeGreaterThanOrEqual(0);
      expect(s.trimX + s.w).toBeLessThanOrEqual(rigMetaJson.frameWidth);
      expect(s.trimY + s.h).toBeLessThanOrEqual(rigMetaJson.frameHeight);
    }

    const untrimmedClips = Object.fromEntries(
      Object.entries(rigMetaJson.clips).map(([k, v]) => [k, { startRow: v.startRow, frames: v.frames }]),
    );
    const fallbackCore = buildTierAtlasPlan({ ...rigMetaJson, clips: untrimmedClips }, CORE_CLIP_NAMES);
    expect(fallbackCore.width).toBeLessThanOrEqual(MAX_PLAYER_ATLAS_DIM);
    expect(fallbackCore.height).toBeLessThanOrEqual(MAX_PLAYER_ATLAS_DIM);
    expect(resolveClipTrim({}, 192, 192)).toEqual({ x: 0, y: 0, w: 192, h: 192 });
  });

  it("only requests lazy secondary animation baking when secondary states are active", () => {
    expect(needsSecondaryAnimTier(makeSnap())).toBe(false);
    expect(needsSecondaryAnimTier(makeSnap({ moving: true, sprinting: true, dodging: true }))).toBe(false);
    expect(needsSecondaryAnimTier(makeSnap({ heldItem: "bow", bowCharge: 0 }))).toBe(false);
    expect(needsSecondaryAnimTier(makeSnap({ crouching: true }))).toBe(true);
    expect(needsSecondaryAnimTier(makeSnap({ inDeepWater: true }))).toBe(true);
    expect(needsSecondaryAnimTier(makeSnap({ jumpZ: 0.2 }))).toBe(true);
    expect(needsSecondaryAnimTier(makeSnap({ respawnTimer: 2 }))).toBe(true);
    expect(needsSecondaryAnimTier(makeSnap({ heldItem: "bow", bowCharge: 0.3 }))).toBe(true);
  });
});
