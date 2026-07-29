import { describe, expect, it } from "vitest";
import {
  applyPlayerLightMode,
  playerCarriesTorch,
  type MutablePlayerLight,
} from "./playerLightMode.js";

const light = (): MutablePlayerLight => ({ color: 0, radiusTiles: 0 });

describe("player light mode", () => {
  it("uses the subtle baseline unless the selected hotbar slot is a torch", () => {
    expect(playerCarriesTorch({ hotbar: ["torch"], selectedSlot: null })).toBe(false);
    expect(playerCarriesTorch({ hotbar: ["torch"], selectedSlot: 0 })).toBe(true);
  });

  it("keeps baseline player reveal broad and subtle while carried torch stays concentrated", () => {
    const baseline = light();
    const carriedTorch = light();
    applyPlayerLightMode(baseline, false);
    applyPlayerLightMode(carriedTorch, true);
    expect(baseline.revealRadiusTiles).toBe(15);
    expect(carriedTorch.revealRadiusTiles).toBe(6);
    expect(baseline.revealCellAlpha).toBeLessThan(carriedTorch.revealCellAlpha ?? 0);
    expect(baseline.revealCellAlpha).toBeGreaterThan(0.1);
    expect(baseline.sourceRevealCellAlpha)
      .toBeGreaterThan(baseline.revealCellAlpha ?? 0);
    expect(carriedTorch.sourceRevealCellAlpha)
      .toBeGreaterThan(baseline.sourceRevealCellAlpha ?? 0);
    expect(carriedTorch.sourceRevealCellRadiusTiles)
      .toBeGreaterThan(baseline.sourceRevealCellRadiusTiles ?? 0);
    expect(baseline.haloAlphaMultiplier).toBe(0);
  });
});
