import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";

describe("enemy AI targeting", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("limits simultaneous attackers assigned to one player", () => {
    for (let index = 0; index < 6; index++) {
      spawnEnemy(sim, {
        defId: "skeleton",
        x: spot.x + 2 + index * 0.2,
        y: spot.y,
      });
    }
    stepEnemies(sim, []);
    const attackers = [...sim.enemies.values()].filter((enemy) =>
      enemy.brain.targetId === "p1"
    );
    expect(attackers).toHaveLength(3);
  });
});
