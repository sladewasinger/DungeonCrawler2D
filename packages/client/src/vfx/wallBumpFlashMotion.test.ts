import { describe, expect, it } from "vitest";
import { wallBumpFlashAlpha, WALL_BUMP_FLASH_MS, WALL_BUMP_FLASH_PEAK_ALPHA } from "./wallBumpFlashMotion.js";

describe("wallBumpFlashAlpha", () => {
  it("starts at the faint peak alpha at spawn", () => {
    expect(wallBumpFlashAlpha(0)).toBe(WALL_BUMP_FLASH_PEAK_ALPHA);
  });

  it("is at half the peak alpha halfway through the fade", () => {
    expect(wallBumpFlashAlpha(WALL_BUMP_FLASH_MS / 2)).toBeCloseTo(WALL_BUMP_FLASH_PEAK_ALPHA / 2);
  });

  it("reaches exactly 0 at WALL_BUMP_FLASH_MS", () => {
    expect(wallBumpFlashAlpha(WALL_BUMP_FLASH_MS)).toBe(0);
  });

  it("is 0 outside the [0, WALL_BUMP_FLASH_MS) window", () => {
    expect(wallBumpFlashAlpha(-1)).toBe(0);
    expect(wallBumpFlashAlpha(WALL_BUMP_FLASH_MS + 10)).toBe(0);
  });
});
