import { describe, expect, it } from "vitest";
import {
  RESIZE_HANDLE_PX,
  clampWindowSize,
  isResizeHandle,
  resizeWindowFromPinch,
  resizeWindowFromPointer,
} from "./HudWindowEditing.js";

const bounds = {
  minWidth: 128,
  minHeight: 72,
  maxWidth: 400,
  maxHeight: 300,
};

describe("HUD window resize geometry", () => {
  it("uses a touch-sized bottom-right resize target", () => {
    const rect = { right: 300, bottom: 200 };
    expect(isResizeHandle(rect, 300 - RESIZE_HANDLE_PX, 200 - RESIZE_HANDLE_PX)).toBe(true);
    expect(isResizeHandle(rect, 300 - RESIZE_HANDLE_PX - 1, 200)).toBe(false);
  });

  it("clamps pointer resizing to the window's available bounds", () => {
    expect(resizeWindowFromPointer({ width: 240, height: 160 }, { x: -200, y: 300 }, bounds))
      .toEqual({ width: 128, height: 300 });
  });

  it("resizes both dimensions proportionally for a pinch", () => {
    expect(resizeWindowFromPinch({ width: 200, height: 100 }, 80, 120, bounds))
      .toEqual({ width: 300, height: 150 });
    expect(clampWindowSize({ width: 900, height: 900 }, bounds))
      .toEqual({ width: 400, height: 300 });
  });
});
