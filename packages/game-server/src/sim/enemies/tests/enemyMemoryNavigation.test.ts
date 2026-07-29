import { NEUTRAL_INPUT, TILE } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { stepEnemies } from "../index.js";
import { enemyPursuitMove } from "../ai/enemyNavigation.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "./enemyAiTestSupport.js";

describe("enemy remembered navigation", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("retains one route across consecutive hidden-target ticks", () => {
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x + 3,
      y: spot.y,
    });
    stepEnemies(sim, []);
    sim.world.replaceTileOverrides([{
      x: Math.floor(spot.x) + 1,
      y: Math.floor(spot.y),
      tile: TILE.CraftingTable,
    }]);
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const route = enemy?.rememberedRoute;
    if (!enemy || !route) throw new Error("missing remembered route");
    stepEnemies(sim, []);
    expect(enemy.rememberedRoute).toBe(route);
  });

  it("clears its cached route while deliberately searching", () => {
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x + 2,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing searching enemy");
    enemy.rememberedRoute = {
      targetId: "p1",
      goalTileX: Math.floor(spot.x),
      goalTileY: Math.floor(spot.y),
      steps: [{ x: spot.x, y: spot.y, jump: false }],
    };
    const move = enemyPursuitMove({
      sim,
      enemy,
      visibleTarget: undefined,
      decision: { move: NEUTRAL_INPUT, searching: true },
    });
    expect(move).toEqual(NEUTRAL_INPUT);
    expect(enemy.rememberedRoute).toBeNull();
  });
});
