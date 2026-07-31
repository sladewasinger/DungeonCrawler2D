import { describe, expect, it } from "vitest";
import { makeEntity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/state.js";
import {
  circleIntersectsHurtbox,
  combatHurtbox,
  ENEMY_HURTBOX,
  PLAYER_HURTBOX,
  reachesHurtbox,
} from "./hurtboxes.js";

function entity(kind: "player" | "enemy", x: number, y = 0) {
  return makeEntity(kind, createBody(x, y, 0), { hp: 10, maxHp: 10 });
}

describe("canonical combat hurtboxes", () => {
  it("uses axis-aligned player and enemy box defaults", () => {
    expect(combatHurtbox("player")).toBe(PLAYER_HURTBOX);
    expect(combatHurtbox("enemy")).toBe(ENEMY_HURTBOX);
    expect(PLAYER_HURTBOX).toEqual({ halfWidth: 0.2, halfDepth: 0.2 });
    expect(ENEMY_HURTBOX).toEqual({ halfWidth: 0.34, halfDepth: 0.34 });
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
