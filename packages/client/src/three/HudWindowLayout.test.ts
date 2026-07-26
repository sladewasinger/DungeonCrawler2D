import { describe, expect, it } from "vitest";
import { anchoredPosition } from "./HudWindowGeometry.js";
import { resolveWindowPosition } from "./HudWindowLayout.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

const freeLayout = (xRatio: number, yRatio: number): HudWindowLayout => ({
  anchor: "free",
  xRatio,
  yRatio,
  width: 280,
  height: 180,
  z: 10,
});

describe("responsive HUD window layout", () => {
  it("keeps a free right-side panel flush right after shrinking the viewport", () => {
    const layout = freeLayout(1, 0.5);
    expect(resolveWindowPosition(layout, { width: 280, height: 180 }, { width: 1280, height: 720 }))
      .toEqual({ x: 1000, y: 270 });
    expect(resolveWindowPosition(layout, { width: 280, height: 180 }, { width: 800, height: 500 }))
      .toEqual({ x: 520, y: 160 });
  });

  it("places a free panel proportionally within the usable movement area", () => {
    const layout = freeLayout(0.25, 0.75);
    expect(resolveWindowPosition(layout, { width: 200, height: 100 }, { width: 1000, height: 500 }))
      .toEqual({ x: 200, y: 300 });
  });

  it("keeps anchored panels on-screen in undersized viewports", () => {
    expect(anchoredPosition("bottom-right", 280, 180, 200, 100))
      .toEqual({ x: 0, y: 0 });
  });
});
