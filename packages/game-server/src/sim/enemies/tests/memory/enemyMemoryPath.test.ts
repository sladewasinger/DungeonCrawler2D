import {
  createBody,
  makeEntity,
  newBrain,
  type EnemyDef,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { findEnemyMemoryPath } from "../../ai/enemyMemoryPath.js";

const ENEMY_DEF: EnemyDef = {
  id: "memory-path-fixture",
  name: "Memory Path Fixture",
  tags: [],
  hp: 10,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 1, range: 0.5, cooldown: 1 },
  drops: [],
  sprite: "slime",
};

describe("enemy remembered path", () => {
  it("finds a detour around a wall wider than the former search margin", () => {
    const path = findEnemyMemoryPath({
      sim: longWallSim(),
      enemy: memoryPathEnemy(),
      pursuit: { x: 6.5, y: 0.5, z: 0 },
    });

    expect(path).toHaveLength(26);
    expect(path.some((step) => Math.abs(step.y - 0.5) >= 10)).toBe(true);
  });
});

function longWallSim(): SimState {
  return {
    world: {
      isWalkable: (x: number, y: number) => !longWallAt(x, y),
      isSanctuary: () => false,
      heightAt: () => 0,
      groundAt: () => 0,
      stairHeightAt: () => null,
    },
  } as unknown as SimState;
}

function memoryPathEnemy(): EnemySlot {
  const entity = makeEntity(
    "enemy",
    createBody(0.5, 0.5, 0),
    { id: "memory-path-enemy", hp: 10, maxHp: 10 },
  );
  return {
    entity,
    brain: newBrain(),
    def: ENEMY_DEF,
    animation: { state: "idle", ticksRemaining: 0 },
  };
}

function longWallAt(x: number, y: number): boolean {
  return Math.floor(x) === 3 &&
    Math.floor(y) >= -9 && Math.floor(y) <= 9;
}
