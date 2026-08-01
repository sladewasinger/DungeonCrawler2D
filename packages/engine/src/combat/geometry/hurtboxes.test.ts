import { describe, expect, it } from "vitest";
import { makeEntity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/state.js";
import {
  circleIntersectsHurtbox,
  combatHurtbox,
  combatHurtboxBounds,
  ENEMY_HURTBOX,
  DEFAULT_HURTBOX,
  PLAYER_HURTBOX,
  PROJECTILE_CONTACT_RADIUS,
  reachesHurtbox,
  verticalRangeIntersectsHurtbox,
} from "./hurtboxes.js";

function entity(kind: "player" | "enemy", x: number, y = 0) {
  return makeEntity(kind, createBody(x, y, 0), { hp: 10, maxHp: 10 });
}

describe("canonical combat hurtboxes", () => {
  it("uses axis-aligned player and enemy box defaults", () => {
    const player = entity("player", 0);
    expect(combatHurtbox("player")).toBe(PLAYER_HURTBOX);
    expect(combatHurtbox(player)).toEqual(PLAYER_HURTBOX);
    expect(combatHurtbox("enemy")).toBe(ENEMY_HURTBOX);
    expect(ENEMY_HURTBOX).toEqual({
      halfWidth: 0.5416666667,
      halfDepth: 0.5416666667,
      height: 1.0833333333,
      bottomOffset: 0.0416666667,
    });
    expect(DEFAULT_HURTBOX).toEqual({
      halfWidth: 0.25,
      halfDepth: 0.25,
      height: 1,
      bottomOffset: 0,
    });
  });

  it("keeps the lowered player top and projectile-contact boundary exact", () => {
    const target = entity("player", 0);
    const bounds = combatHurtboxBounds(target);
    const tangent = bounds.maxZ + PROJECTILE_CONTACT_RADIUS;

    expect(bounds.minZ).toBe(target.body.z - PLAYER_HURTBOX.bottomOffset);
    expect(bounds.maxZ).toBe(bounds.minZ + PLAYER_HURTBOX.height);
    expect(verticalRangeIntersectsHurtbox(
      tangent - PROJECTILE_CONTACT_RADIUS,
      tangent + PROJECTILE_CONTACT_RADIUS,
      target,
    )).toBe(true);
    expect(verticalRangeIntersectsHurtbox(
      tangent + 0.0000000001 - PROJECTILE_CONTACT_RADIUS,
      tangent + 0.0000000001 + PROJECTILE_CONTACT_RADIUS,
      target,
    )).toBe(false);
  });

  it("uses the same padded vertical volume for debug bounds and contacts", () => {
    const target = entity("enemy", 1);
    target.combatHurtbox = {
      halfWidth: 0.5,
      halfDepth: 0.5,
      height: 2,
      bottomOffset: 0.1,
    };

    expect(combatHurtboxBounds(target)).toMatchObject({ minZ: -0.1, maxZ: 1.9 });
    expect(verticalRangeIntersectsHurtbox(1.8, 2.1, target)).toBe(true);
    expect(verticalRangeIntersectsHurtbox(2, 2.1, target)).toBe(false);
  });

  it("honors a definition-authored rectangular hurtbox", () => {
    const target = entity("enemy", 2.5, 0.2);
    target.combatHurtbox = { halfWidth: 1, halfDepth: 0.2 };

    expect(reachesHurtbox(entity("player", 0), target, 1.5)).toBe(true);
    target.combatHurtbox = { halfWidth: 0.2, halfDepth: 0.2 };
    expect(reachesHurtbox(entity("player", 0), target, 1.5)).toBe(false);
  });

  it("uses the closest AABB corner for radial and projectile tangency", () => {
    const target = entity("enemy", 1.2, 1.2);
    target.combatHurtbox = { halfWidth: 0.2, halfDepth: 0.2 };
    const cornerDistance = Math.SQRT2;

    expect(reachesHurtbox(entity("player", 0), target, cornerDistance)).toBe(true);
    expect(reachesHurtbox(entity("player", 0), target, cornerDistance - 0.001)).toBe(false);
    expect(circleIntersectsHurtbox({ x: 0.8, y: 1 }, 0.2, target)).toBe(true);
    expect(circleIntersectsHurtbox({ x: 0.799, y: 1 }, 0.2, target)).toBe(false);
  });
});
