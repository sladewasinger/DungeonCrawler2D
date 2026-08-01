// Owns target assignment, revalidation, and bounded memory regression coverage.
import { ENEMY_ACTIVE_RADIUS, TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";

describe("enemy target acquisition", () => {
  it("clears an out-of-aggro target while retaining memory inside active simulation", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const entity = spawnEnemy(sim, {
      defId: "pitchbloom",
      x: spot.x + 4,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing target lifecycle enemy");

    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBe(player.entity.id);

    player.entity.body.x = enemy.entity.body.x + enemy.def.aggroRadius + 1;
    player.entity.body.y = enemy.entity.body.y;
    stepEnemies(sim, []);

    expect(Math.abs(player.entity.body.x - enemy.entity.body.x))
      .toBeLessThan(ENEMY_ACTIVE_RADIUS);
    expect(enemy.brain.targetId).toBeNull();
    expect(enemy.brain.rememberedTarget?.targetId).toBe(player.entity.id);
    expect(enemy.brain.memorySecondsRemaining).toBeGreaterThan(0);
  });

  it("reacquires the same target when it returns to visible aggro range", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const entity = spawnEnemy(sim, {
      defId: "pitchbloom",
      x: spot.x + 4,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing reacquisition enemy");

    stepEnemies(sim, []);
    player.entity.body.x = enemy.entity.body.x + enemy.def.aggroRadius + 1;
    player.entity.body.y = enemy.entity.body.y;
    stepEnemies(sim, []);
    player.entity.body.x = enemy.entity.body.x + 4;
    player.entity.body.y = enemy.entity.body.y;
    player.entity.body.z = sim.world.groundAt(
      player.entity.body.x,
      player.entity.body.y,
    );
    stepEnemies(sim, []);

    expect(enemy.brain.targetId).toBe(player.entity.id);
  });

  it("clears and reacquires a target when terrain LOS is obstructed inside aggro range", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const entity = spawnEnemy(sim, {
      defId: "pitchbloom",
      x: spot.x + 4,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing LOS enemy");

    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBe(player.entity.id);
    expect(Math.hypot(
      player.entity.body.x - enemy.entity.body.x,
      player.entity.body.y - enemy.entity.body.y,
    )).toBeLessThan(enemy.def.aggroRadius);
    expect(Math.abs(player.entity.body.x - enemy.entity.body.x))
      .toBeLessThan(ENEMY_ACTIVE_RADIUS);

    sim.world.replaceTileOverrides([{
      x: Math.floor(spot.x) + 1,
      y: Math.floor(spot.y),
      tile: TILE.CraftingTable,
    }]);
    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBeNull();
    expect(enemy.brain.rememberedTarget?.targetId).toBe(player.entity.id);

    sim.world.replaceTileOverrides([]);
    stepEnemies(sim, []);

    expect(enemy.brain.targetId).toBe(player.entity.id);
  });
});
