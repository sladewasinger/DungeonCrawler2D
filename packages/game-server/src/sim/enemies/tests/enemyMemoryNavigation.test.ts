import { NEUTRAL_INPUT, TILE } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import { stepEnemies } from "../index.js";
import { chaseToPoint, enemyPursuitMove } from "../ai/enemyNavigation.js";
import { moveEnemy } from "../ai/enemyMovement.js";
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

  it("routes visible-target spacing pursuits through pathing detours", () => {
    const tileX = Math.floor(spot.x);
    const tileY = Math.floor(spot.y);
    sim.world.replaceTileOverrides([
      { x: tileX + 3, y: tileY + 1, tile: TILE.CraftingTable },
    ]);
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: tileX + 3.5,
      y: tileY + 0.5,
    });
    const player = sim.players.get("p1")?.entity;
    if (!player) throw new Error("missing visible pursuit target");
    player.body.x = tileX + 3.5;
    player.body.y = tileY + 5.5;

    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing spacing pursuit fixture");
    const standoff = {
      x: player.body.x,
      y: player.body.y + 1,
      z: player.body.z,
    };

    const move = enemyPursuitMove({
      sim,
      enemy,
      visibleTarget: player,
      decision: { move: NEUTRAL_INPUT, pursuit: standoff },
    });

    expect(move).not.toEqual({ moveX: 0, moveY: 1, jump: false });
  });

  it("scales a near slot approach without reversing after settling", () => {
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x + 2,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing analog pursuit enemy");
    const point = {
      x: enemy.entity.body.x + 0.04,
      y: enemy.entity.body.y + 0.03,
    };
    const moves = [];
    for (let tick = 0; tick < 3; tick += 1) {
      const move = chaseToPoint({
        enemy: enemy.entity,
        point,
        speed: enemy.entity.baseSpeed,
      });
      moves.push(move);
      moveEnemy({ sim, enemy, move, graced: [] });
    }

    expect(Math.hypot(moves[0]!.moveX, moves[0]!.moveY)).toBeLessThan(1);
    expect(moves[1]).toEqual({ moveX: 0, moveY: 0, jump: false });
    expect(moves[2]).toEqual({ moveX: 0, moveY: 0, jump: false });
  });
});
