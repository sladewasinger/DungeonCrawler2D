import { describe, expect, it } from "vitest";
import {
  WEAPON_ARCHETYPES, WEAPON_MOVESETS, getWeaponMoveset, getWeaponStepSpec, resolveWeaponArchetype,
  resolveWeaponAttackStep,
} from "./weaponMovesets.js";

describe("weaponMovesets", () => {
  it("resolves explicit and item-id weapon archetypes with unarmed fallback", () => {
    expect(resolveWeaponArchetype("sword")).toBe("sword");
    expect(resolveWeaponArchetype("iron-axe", "axe")).toBe("axe");
    expect(resolveWeaponArchetype("bandage")).toBe("unarmed");
    expect(resolveWeaponArchetype(null)).toBe("unarmed");
  });

  it("cycles combo steps accurately across 3-hit sword, 2-hit axe/torch, and 1-hit pickaxe movesets", () => {
    const s1 = resolveWeaponAttackStep({ archetype: "sword", currentStep: 0, comboActive: false });
    const s2 = resolveWeaponAttackStep({ archetype: "sword", currentStep: s1.stepIndex, comboActive: true });
    const s3 = resolveWeaponAttackStep({ archetype: "sword", currentStep: s2.stepIndex, comboActive: true });
    const s4 = resolveWeaponAttackStep({ archetype: "sword", currentStep: s3.stepIndex, comboActive: true });
    expect([s1.stepIndex, s2.stepIndex, s3.stepIndex, s4.stepIndex]).toEqual([1, 2, 3, 1]);
    expect([s1.spec.motion, s2.spec.motion, s3.spec.motion]).toEqual(["slash", "backhand", "lunge"]);

    const axe1 = resolveWeaponAttackStep({ archetype: "axe", currentStep: 0, comboActive: false });
    const axe2 = resolveWeaponAttackStep({ archetype: "axe", currentStep: axe1.stepIndex, comboActive: true });
    const axe3 = resolveWeaponAttackStep({ archetype: "axe", currentStep: axe2.stepIndex, comboActive: true });
    expect([axe1.stepIndex, axe2.stepIndex, axe3.stepIndex]).toEqual([1, 2, 1]);
    expect([axe1.spec.motion, axe2.spec.motion]).toEqual(["chop", "cleave"]);
    expect(axe1.moveset.harvestKind).toBe("wood");

    const pick = resolveWeaponAttackStep({ archetype: "pickaxe", currentStep: 1, comboActive: true });
    expect(pick.stepIndex).toBe(1);
    expect(pick.spec.motion).toBe("overheadSlam");

    const torch2 = resolveWeaponAttackStep({ archetype: "torch", currentStep: 1, comboActive: true });
    expect(torch2.spec.motion).toBe("thrust");
    expect(torch2.spec.ignites).toBe(true);

    const punch1 = resolveWeaponAttackStep({ archetype: "unarmed", currentStep: 0, comboActive: false });
    const punch2 = resolveWeaponAttackStep({ archetype: "unarmed", currentStep: punch1.stepIndex, comboActive: true });
    expect([punch1.spec.motion, punch2.spec.motion]).toEqual(["punch", "punch"]);
    expect([punch1.spec.sweepDir, punch2.spec.sweepDir]).toEqual([1, -1]);
  });

  it("defines valid positive movesets, harvest hooks, and stealth crit multipliers for all archetypes", () => {
    for (const archetype of WEAPON_ARCHETYPES) {
      const set = getWeaponMoveset(archetype);
      expect(set).toBe(WEAPON_MOVESETS[archetype]);
      expect(set.steps.length).toBeGreaterThanOrEqual(1);
      expect(set.backstabMult).toBeGreaterThanOrEqual(1.75);
      const first = getWeaponStepSpec(archetype, 1);
      expect(first.swingDurationSec).toBeGreaterThan(0);
    }
    expect(getWeaponMoveset("pickaxe").harvestKind).toBe("stone");
    expect(getWeaponMoveset("dagger").backstabMult).toBe(3.0);
    expect(getWeaponStepSpec("spear", 2).rangeMult).toBeGreaterThan(1.3);
  });
});
