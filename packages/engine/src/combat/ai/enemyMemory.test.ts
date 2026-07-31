import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../core/constants.js";
import type { EnemyDef } from "../../effects/types.js";
import { makeEntity } from "../../entities/entity.js";
import {
  createBody,
  stepBody,
} from "../../entities/movement/index.js";
import type { WorldView } from "../../world/core/types.js";
import { enemyThink, newBrain } from "./ai.js";

const slime: EnemyDef = {
  id: "slime",
  name: "Slime",
  tags: ["organic"],
  hp: 12,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 },
  drops: [],
  sprite: "slime",
};

function entity(kind: "player" | "enemy", x: number, z = 0) {
  return makeEntity(kind, createBody(x, 0, z), {
    hp: 20,
    maxHp: 20,
  });
}

const flatWorld: WorldView = {
  isWalkable: () => true,
  heightAt: () => 0,
  groundAt: () => 0,
  stairHeightAt: () => null,
};

describe("enemy pursuit memory", () => {
  it("pursues the last-seen position while memory remains", () => {
    const brain = newBrain();
    const enemy = entity("enemy", 0);
    const player = entity("player", 5);
    enemyThink({
      brain,
      enemy,
      def: slime,
      players: [player],
      inSanctuary: () => false,
      dt: 0.05,
      rng: () => 0.5,
      memorySeconds: 20,
    });
    const search = enemyThink({
      brain,
      enemy,
      def: slime,
      players: [],
      inSanctuary: () => false,
      dt: 0.05,
      rng: () => 0.5,
      memorySeconds: 20,
    });
    expect(search.pursuit).toMatchObject({ x: 5, y: 0 });
    expect(brain.memorySecondsRemaining).toBeCloseTo(19.95);
  });

  it("chases rather than striking a player on the ledge above", () => {
    const brain = newBrain();
    const enemy = entity("enemy", 0);
    const player = entity("player", 0.5, 1);
    const decision = enemyThink({
      brain,
      enemy,
      def: slime,
      players: [player],
      inSanctuary: () => false,
      dt: 0.05,
      rng: () => 0.5,
      maximumMeleeHeightDifference: 0.5,
    });
    expect(decision.strike).toBeUndefined();
    expect(decision.pursuit).toMatchObject({ z: 1 });
  });

  it("enters search without reversing at the hidden target point", () => {
    const brain = newBrain();
    const enemy = entity("enemy", 0);
    const player = entity("player", 1.05);
    enemyThink({
      brain,
      enemy,
      def: slime,
      players: [player],
      inSanctuary: () => false,
      dt: TICK_DT,
      rng: () => 0.5,
      memorySeconds: 20,
    });
    const decisions = hiddenTargetSequence(brain, enemy, 32);
    const searchStart = decisions.findIndex((decision) => decision.searching);
    expect(searchStart).toBeGreaterThan(0);
    expect(hasAlternatingHorizontalSigns(decisions)).toBe(false);
    expect(decisions[searchStart]?.move)
      .toEqual({ moveX: 0, moveY: 0, jump: false });
    expect(brain.rememberedTarget).toBeNull();
  });
});

function hiddenTargetSequence(
  brain: ReturnType<typeof newBrain>,
  enemy: ReturnType<typeof entity>,
  ticks: number,
) {
  return Array.from({ length: ticks }, () => {
    const decision = enemyThink({
      brain,
      enemy,
      def: slime,
      players: [],
      inSanctuary: () => false,
      dt: TICK_DT,
      rng: () => 0.5,
      memorySeconds: 20,
      memorySearchSeconds: 1,
      memoryArrivalTolerance: Math.max(
        0.3,
        slime.speed * TICK_DT + 0.1,
      ),
    });
    stepBody(flatWorld, enemy.body, decision.move, TICK_DT, {
      speed: slime.speed,
    });
    return decision;
  });
}

function hasAlternatingHorizontalSigns(
  decisions: ReturnType<typeof hiddenTargetSequence>,
): boolean {
  return decisions.some((decision, index) => {
    const previous = decisions[index - 1];
    return previous !== undefined &&
      decision.move.moveX * previous.move.moveX < 0;
  });
}
