import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { stepEnemies } from "../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
  launchEnemyForPhysicsTest,
} from "./enemyAiTestSupport.js";

describe("enemy airborne physics", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("continues falling while outside active AI range", () => {
    const enemy = spawnEnemy(sim, {
      defId: "slime",
      x: spot.x,
      y: spot.y,
    });
    const player = sim.players.get("p1");
    if (!player) throw new Error("missing inactive physics player");
    player.connected = false;
    launchEnemyForPhysicsTest(enemy);
    const before = { x: enemy.body.x, y: enemy.body.y, z: enemy.body.z };
    stepEnemies(sim, []);
    stepEnemies(sim, []);
    expect(enemy.body).toMatchObject({ x: before.x, y: before.y });
    expect(enemy.body.z).toBeLessThan(before.z);
  });

  it("continues falling during a committed attack without AI movement", () => {
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x + 2,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing airborne attack enemy");
    enemy.animation = { state: "attack", ticksRemaining: 4 };
    launchEnemyForPhysicsTest(entity);
    const before = { x: entity.body.x, y: entity.body.y, z: entity.body.z };
    stepEnemies(sim, []);
    stepEnemies(sim, []);
    expect(entity.body).toMatchObject({ x: before.x, y: before.y });
    expect(entity.body.z).toBeLessThan(before.z);
    expect(enemy.animation.state).toBe("attack");
  });
});
