import { describe, expect, it } from "vitest";
import {
  BOW_MAX_CHARGE_SEC,
  computeMitigatedDamage,
  evaluateBowShot,
  getWeaponStepSpec,
  isInSanctuary,
  isInWorldSanctuary,
  isWithinSector,
  segmentHitsEllipse,
} from "../index.js";
import { projectileHurtbox } from "./hitboxes/combatShapes.js";

describe("combatRules", () => {
  it("detects safe spawn campfire sanctuary and scales defense mitigation", () => {
    expect(isInSanctuary(0.5, 0.5)).toBe(true);
    expect(isInSanctuary(6.5, 0.5)).toBe(true);
    expect(isInSanctuary(9.5, 0.5)).toBe(false);
    expect(isInWorldSanctuary({ poisNear: () => [{ centerX: 50, centerY: 50, radiusX: 4, radiusY: 4, isSanctuary: true }] }, 54.5, 50)).toBe(true);
    expect(isInWorldSanctuary({ poisNear: () => [{ centerX: 50, centerY: 50, radiusX: 4, radiusY: 4, isSanctuary: false }] }, 51, 50)).toBe(false);
    expect(computeMitigatedDamage(20, 0)).toBe(20);
    expect(computeMitigatedDamage(20, 13)).toBeLessThan(15);
    expect(computeMitigatedDamage(1, 50)).toBe(1);
  });

  it("evaluates weapon moveset scaling, bow charge scaling, and directional sector hits", () => {
    expect(getWeaponStepSpec("sword", 1).damageMult).toBe(1.0);
    expect(getWeaponStepSpec("sword", 3).damageMult).toBe(1.48);
    const quick = evaluateBowShot(0);
    const full = evaluateBowShot(BOW_MAX_CHARGE_SEC * 2);
    expect(full.ratio).toBe(1);
    expect(full.damageMult).toBeGreaterThan(quick.damageMult);
    expect(full.speedTilesPerSec).toBeGreaterThan(quick.speedTilesPerSec);

    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: 1.5, y: 0.3 }, range: 1.85, halfArcRad: 0.9 })).toBe(true);
    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: -1.0, y: 0 }, range: 1.85, halfArcRad: 0.9 })).toBe(false);
    expect(isWithinSector({ origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, target: { x: 2.5, y: 0 }, range: 1.85, halfArcRad: 0.9 })).toBe(false);
  });

  it("detects swept projectile segment intersections across elliptical entity hurtboxes without tunneling", () => {
    const box = projectileHurtbox({ x: 5, y: 5 }, "goblin");
    expect(segmentHitsEllipse({ x0: 4.1, y0: 5, x1: 6.1, y1: 5, box })).not.toBeNull();
    expect(segmentHitsEllipse({ x0: 3.5, y0: 4.4, x1: 6.5, y1: 4.4, box })).not.toBeNull();
    expect(segmentHitsEllipse({ x0: 3.5, y0: 7.2, x1: 6.5, y1: 7.2, box })).toBeNull();
  });
});
