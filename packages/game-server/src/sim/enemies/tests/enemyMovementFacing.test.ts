import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import { moveEnemy } from "../ai/enemyMovement.js";
import {
  createEnemyTestSim,
  findEnemyTestFloor,
} from "./enemyAiTestSupport.js";

describe("enemy movement facing", () => {
  it("faces actual collision-resolved motion instead of blocked intent", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const wallX = Math.floor(spot.x) + 1;
    sim.world.replaceTileOverrides([{
      x: wallX,
      y: Math.floor(spot.y),
      tile: TILE.CraftingTable,
    }]);
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: wallX - 0.25,
      y: spot.y,
    });
    entity.facing = { x: 0, y: 1 };
    const before = { x: entity.body.x, y: entity.body.y };
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing collision-facing enemy");
    moveEnemy({
      sim,
      enemy,
      move: { moveX: 1, moveY: 0, jump: false },
      graced: [],
    });
    const motion = {
      x: entity.body.x - before.x,
      y: entity.body.y - before.y,
    };
    assertFacingMatchesMotion(entity.facing, motion);
  });
});

function assertFacingMatchesMotion(
  facing: { x: number; y: number } | undefined,
  motion: { x: number; y: number },
): void {
  if (!facing) throw new Error("enemy has no facing");
  const distance = Math.hypot(motion.x, motion.y);
  if (distance === 0) {
    expect(facing).toEqual({ x: 0, y: 1 });
    return;
  }
  expect(facing.x).toBeCloseTo(motion.x / distance);
  expect(facing.y).toBeCloseTo(motion.y / distance);
}
