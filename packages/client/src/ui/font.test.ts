// Headless tests for uiTextStyle's resolution math — the fix behind "HUD text is
// blurry" (docs/VISUAL_DIRECTION.md §UI): resolution must track both the display's
// devicePixelRatio and any ancestor widget-container scale the Text will be
// stretched by, or the glyph bitmap is baked below its final on-screen density.
import { afterEach, describe, expect, it, vi } from "vitest";
import { uiTextStyle } from "./font.js";

function stubDevicePixelRatio(ratio: number): void {
  vi.stubGlobal("window", { devicePixelRatio: ratio });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uiTextStyle", () => {
  it("resolves to just devicePixelRatio when no container scale applies", () => {
    stubDevicePixelRatio(2);
    expect(uiTextStyle(12).resolution).toBe(2);
  });

  it("folds a widget container's scale into resolution, not just devicePixelRatio", () => {
    stubDevicePixelRatio(1);
    expect(uiTextStyle(12, undefined, 2).resolution).toBe(2);
  });

  it("stacks devicePixelRatio and container scale for the phone + hudScale case", () => {
    stubDevicePixelRatio(3);
    expect(uiTextStyle(12, undefined, 2).resolution).toBe(6);
  });

  it("never drops resolution below 1 even if devicePixelRatio reads 0", () => {
    stubDevicePixelRatio(0);
    expect(uiTextStyle(12).resolution).toBe(1);
  });

  it("defaults to 400 weight (unset emphasis) for everyday labels", () => {
    stubDevicePixelRatio(1);
    expect(uiTextStyle(12).fontStyle).toBe("400");
  });

  it("requests 600 weight for emphasis text (readouts, section titles)", () => {
    stubDevicePixelRatio(1);
    expect(uiTextStyle(12, undefined, 1, "emphasis").fontStyle).toBe("600");
  });

  it("keeps the system-sans stack, never the pixel font, for HUD text", () => {
    stubDevicePixelRatio(1);
    expect(uiTextStyle(12).fontFamily).not.toContain("monogram");
  });
});
