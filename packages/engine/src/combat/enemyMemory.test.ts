import { describe, expect, it } from "vitest";
import type { EnemyDef } from "../effects/types.js";
import { makeEntity } from "../entities/entity.js";
import { createBody } from "../entities/movement/index.js";
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
});
