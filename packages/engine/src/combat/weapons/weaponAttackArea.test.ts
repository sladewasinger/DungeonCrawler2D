import { describe, expect, it } from "vitest";
import { makeEntity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/state.js";
import { resolveWeaponProfile } from "./weaponProfiles.js";
import {
  weaponAttackContainsPoint,
  weaponAttackIntersectsHurtbox,
} from "./weaponTargeting.js";

function attacker() {
  return makeEntity("player", createBody(0, 0, 0), { id: "attacker" });
}

function weaponProfile(shape: "cone" | "ground" = "cone") {
  return resolveWeaponProfile({
    weapon: {
      damage: 1,
      range: 2.4,
      cooldownMs: 350,
      shape,
      arcCos: 0.7071,
      knockbackForce: 0,
    },
  });
}

function intersects(input: {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly shape?: "cone" | "ground";
}): boolean {
  return weaponAttackContainsPoint({
    attacker: attacker(),
    direction: { x: 1, y: 0 },
    point: { x: input.x, y: input.y, z: input.z ?? 0.8 },
    pointRadius: 0.25,
    profile: weaponProfile(input.shape),
  });
}

describe("weapon attack areas", () => {
  it("includes a projectile volume at the extended cone edge", () => {
    expect(intersects({ x: 2.62, y: 0 })).toBe(true);
  });

  it("rejects a projectile outside the cone or effective reach", () => {
    expect(intersects({ x: 1, y: 1.5 })).toBe(false);
    expect(intersects({ x: 2.7, y: 0 })).toBe(false);
  });

  it("uses the full ground profile and the shared height band", () => {
    expect(intersects({ x: 0, y: 2.5, shape: "ground" })).toBe(true);
    expect(intersects({ x: 1, y: 0, z: 1.6 })).toBe(false);
  });

  it("does not combine separate range and angle allowances into a false hit", () => {
    const distance = 2.6;
    const radians = 50 * Math.PI / 180;
    expect(intersects({
      x: Math.cos(radians) * distance,
      y: Math.sin(radians) * distance,
    })).toBe(false);
  });

  it("includes a rectangular hurtbox tangent to the cone boundary", () => {
    const target = makeEntity("enemy", createBody(1.15, 1.15, 0.8), {
      combatHurtbox: { halfWidth: 0.15, halfDepth: 0.15 },
      hp: 10,
    });
    expect(weaponAttackIntersectsHurtbox({
      attacker: attacker(),
      direction: { x: 1, y: 0 },
      profile: weaponProfile(),
      target,
    })).toBe(true);
  });

  it("rejects an in-range box wholly beyond the cone boundary", () => {
    const target = makeEntity("enemy", createBody(1.15, 1.46, 0.8), {
      combatHurtbox: { halfWidth: 0.15, halfDepth: 0.15 },
      hp: 10,
    });
    expect(weaponAttackIntersectsHurtbox({
      attacker: attacker(),
      direction: { x: 1, y: 0 },
      profile: weaponProfile(),
      target,
    })).toBe(false);
  });

  it("connects when a large box reaches into the raw cone", () => {
    const target = makeEntity("enemy", createBody(3, 0, 0.8), {
      combatHurtbox: { halfWidth: 0.6, halfDepth: 0.8 },
      hp: 10,
    });
    expect(weaponAttackIntersectsHurtbox({
      attacker: attacker(),
      direction: { x: 1, y: 0 },
      profile: weaponProfile(),
      target,
    })).toBe(true);
  });
});
