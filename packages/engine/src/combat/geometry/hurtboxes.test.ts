import { describe, expect, it } from "vitest";
import { makeEntity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/state.js";
import {
  combatHurtboxRadius,
  ENEMY_HURTBOX_RADIUS,
  PLAYER_HURTBOX_RADIUS,
  reachesHurtbox,
} from "./hurtboxes.js";

function entity(kind: "player" | "enemy", x: number, y = 0) {
  return makeEntity(kind, createBody(x, y, 0), { hp: 10, maxHp: 10 });
}

describe("canonical combat hurtboxes", () => {
  it("uses the intended player and enemy radii", () => {
    expect(combatHurtboxRadius("player")).toBe(PLAYER_HURTBOX_RADIUS);
    expect(combatHurtboxRadius("enemy")).toBe(ENEMY_HURTBOX_RADIUS);
    expect(PLAYER_HURTBOX_RADIUS).toBe(0.2);
    expect(ENEMY_HURTBOX_RADIUS).toBe(0.34);
  });

  it("includes an enemy target hurtbox at the attack range boundary", () => {
    const attacker = entity("player", 0);
    const target = entity("enemy", 1.6 + ENEMY_HURTBOX_RADIUS);
    expect(reachesHurtbox(attacker, target, 1.6)).toBe(true);
    target.body.x += 0.01;
    expect(reachesHurtbox(attacker, target, 1.6)).toBe(false);
  });

  it("includes a player target hurtbox at the attack range boundary", () => {
    const attacker = entity("enemy", 0);
    const target = entity("player", 1.6 + PLAYER_HURTBOX_RADIUS);
    expect(reachesHurtbox(attacker, target, 1.6)).toBe(true);
    target.body.x += 0.01;
    expect(reachesHurtbox(attacker, target, 1.6)).toBe(false);
  });
});
