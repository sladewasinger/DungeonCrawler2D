import { BODY_RADIUS, GUARD_COLLISION_RADIUS_TILES } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { notifyBlockFeedback } from "../../../combat/blockFeedback.js";
import { spawnEnemy } from "../../../core/helpers.js";
import { moveEnemy } from "../../ai/enemyMovement.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";

describe("enemy movement against an active guard volume", () => {
  it("stops an enemy before its body enters the blocking player's guard", () => {
    const sim = createEnemyTestSim();
    const playerSpot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, playerSpot);
    player.blocking = true;
    player.entity.facing = { x: 1, y: 0 };

    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: playerSpot.x + 1.3,
      y: playerSpot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing guard-collision enemy");
    for (let step = 0; step < 20; step += 1) {
      moveEnemy({ sim, enemy, move: { moveX: -1, moveY: 0, jump: false }, graced: [] });
    }

    expect(enemy.entity.body.x - player.entity.body.x).toBeGreaterThanOrEqual(
      GUARD_COLLISION_RADIUS_TILES + BODY_RADIUS - 0.02,
    );
  });

  it("keeps the guard volume authoritative after a successful melee block", () => {
    const sim = createEnemyTestSim();
    const playerSpot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, playerSpot);
    player.blocking = true;
    player.entity.facing = { x: 1, y: 0 };
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: playerSpot.x + 1.3,
      y: playerSpot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing guard-collision enemy");
    notifyBlockFeedback(sim, player.entity, "melee");

    for (let step = 0; step < 20; step += 1) {
      moveEnemy({ sim, enemy, move: { moveX: -1, moveY: 0, jump: false }, graced: [] });
    }

    expect(player.outbox).toContainEqual({ t: "blockFeedback", kind: "melee" });
    expect(enemy.entity.body.x - player.entity.body.x).toBeGreaterThanOrEqual(
      GUARD_COLLISION_RADIUS_TILES + BODY_RADIUS - 0.02,
    );
  });

  it("depenetrates an enemy that begins inside an active guard", () => {
    const sim = createEnemyTestSim();
    const playerSpot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, playerSpot);
    player.blocking = true;
    player.entity.facing = { x: 1, y: 0 };

    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: playerSpot.x + 0.4,
      y: playerSpot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing overlapping guard-collision enemy");

    moveEnemy({ sim, enemy, move: { moveX: -1, moveY: 0, jump: false }, graced: [] });

    expect(enemy.entity.body.x - player.entity.body.x).toBeGreaterThan(
      GUARD_COLLISION_RADIUS_TILES + BODY_RADIUS,
    );
  });

  it("depenetrates an enemy at the guard center through the guarded front", () => {
    const sim = createEnemyTestSim();
    const playerSpot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, playerSpot);
    player.blocking = true;
    player.entity.facing = { x: 1, y: 0 };

    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: playerSpot.x,
      y: playerSpot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing centered guard-collision enemy");

    moveEnemy({ sim, enemy, move: { moveX: 0, moveY: 0, jump: false }, graced: [] });

    expect(enemy.entity.body.x - player.entity.body.x).toBeGreaterThan(
      GUARD_COLLISION_RADIUS_TILES + BODY_RADIUS,
    );
    expect(enemy.entity.body.y).toBe(player.entity.body.y);
  });
});
