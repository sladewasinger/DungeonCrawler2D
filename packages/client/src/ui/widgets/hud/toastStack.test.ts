import { describe, expect, it } from "vitest";
import { MAX_VISIBLE, wrapWidthFor } from "./toastStack.js";

describe("wrapWidthFor (toast text word-wrap budget)", () => {
  it("caps at MAX_WRAP_WIDTH on a roomy desktop viewport", () => {
    expect(wrapWidthFor({ width: 1280, height: 720 }, 2)).toBe(360);
  });

  it("shrinks below MAX_WRAP_WIDTH on a narrow mobile-portrait viewport at the shipped hudScale (2) — the wave7b-mobile-clean.png overflow fix", () => {
    const width = wrapWidthFor({ width: 390, height: 844 }, 2);
    expect(width).toBeLessThan(360);
    expect(width).toBe((390 - 32) / 2);
  });

  it("divides the screen-space budget back down by the container's own scale", () => {
    expect(wrapWidthFor({ width: 400, height: 300 }, 2)).toBe((400 - 32) / 2);
  });

  it("never collapses below a readable floor even on a tiny viewport", () => {
    expect(wrapWidthFor({ width: 100, height: 100 }, 3)).toBe(120);
  });
});

describe("toast stack visible cap", () => {
  it("bounds the stack so it can't grow past the health/buffs corner", () => {
    expect(MAX_VISIBLE).toBeLessThanOrEqual(4);
  });
});
