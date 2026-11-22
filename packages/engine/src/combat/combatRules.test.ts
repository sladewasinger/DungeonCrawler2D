import { describe, expect, it } from "vitest";
import {
  BOW_MAX_CHARGE_SEC,
  comboMultiplier,
  computeMitigatedDamage,
  evaluateBowShot,
  isInSanctuary,
  isWithinSector,
} from "./combatRules.js";

describe("combatRules", () => {
  it("detects safe spawn campfire sanctuary and scales defense mitigation", () => {
    expect(isInSanctuary(0.5, 0.5)).toBe(true);
    expect(isInSanctuary(6.5, 0.5)).toBe(true);
    expect(isInSanctuary(9.5, 0.5)).toBe(false);
    expect(computeMitigatedDamage(20, 0)).toBe(20);
    expect(computeMitigatedDamage(20, 13)).toBeLessThan(15);
    expect(computeMitigatedDamage(1, 50)).toBe(1);
  });

  it("evaluates 3-hit combo multipliers, bow charge scaling, and directional sector hits", () => {
    expect(comboMultiplier(1)).toBe(1.0);
    expect(comboMultiplier(3)).toBe(1.45);
    const quick = evaluateBowShot(0);
    const full = evaluateBowShot(BOW_MAX_CHARGE_SEC * 2);
    expect(full.ratio).toBe(1);
    expect(full.damageMult).toBeGreaterThan(quick.damageMult);
    expect(full.speedTilesPerSec).toBeGreaterThan(quick.speedTilesPerSec);

    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: 1.5, y: 0.3 }, range: 1.85, halfArcRad: 0.9 })).toBe(true);
    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: -1.0, y: 0 }, range: 1.85, halfArcRad: 0.9 })).toBe(false);
    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: 2.5, y: 0 }, range: 1.85, halfArcRad: 0.9 })).toBe(false);
  });
});
