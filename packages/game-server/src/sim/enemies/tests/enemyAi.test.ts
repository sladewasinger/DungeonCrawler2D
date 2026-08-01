import { TILE, type EffectEvent } from "@dc2d/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import { stepEnemies } from "../index.js";
import {
  advanceAttackAnimation,
  beginWindup,
} from "../ai/attackAnimation.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "./enemyAiTestSupport.js";

describe("enemy AI", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("freezes enemies with no player within ENEMY_ACTIVE_RADIUS", () => {
    const enemy = spawnEnemy(sim, { defId: "slime", x: spot.x + 1000, y: spot.y + 1000 });
    const before = { x: enemy.body.x, y: enemy.body.y };
    stepEnemies(sim, []);
    expect(enemy.body.x).toBe(before.x);
    expect(enemy.body.y).toBe(before.y);
  });

  it("strikes an adjacent player once in melee range", () => {
    const enemy = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    const player = requirePlayer(sim, "p1").entity;
    const startHp = player.hp;
    stepEnemies(sim, []);
    expect(player.hp).toBeLessThan(startHp);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("fully blocks melee damage, status effects, and knockback with a weapon", () => {
    const enemy = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    const slot = requirePlayer(sim, "p1");
    slot.weapon = "sword";
    slot.blocking = true;
    const startHp = slot.entity.hp;
    const startBody = { ...slot.entity.body };
    const effects: EffectEvent[] = [];
    stepEnemies(sim, effects);
    expect(slot.entity.hp).toBe(startHp);
    expect(slot.entity.statuses).toEqual([]);
    expect(slot.entity.body.kx).toBe(startBody.kx);
    expect(slot.entity.body.ky).toBe(startBody.ky);
    expect(effects).toEqual([]);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("a spitter winds up, then launches a projectile", () => {
    const entity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing spitter fixture");
    expect(enemy.animation.state).toBe("windup");
    for (let count = 0; count < 5; count++) stepEnemies(sim, []);
    expect(enemy.animation.state).toBe("spit");
    expect(sim.projectiles.size).toBe(1);
  });

  it("keeps Pitchbloom at one oil lob without burst-selection RNG", () => {
    const burst = vi.spyOn(sim.rng, "int");
    const entity = spawnEnemy(sim, { defId: "pitchbloom", x: spot.x + 4, y: spot.y });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing Pitchbloom fixture");
    stepEnemies(sim, []);
    for (let count = 0; count < 5; count++) stepEnemies(sim, []);
    expect(sim.projectiles.size).toBe(1);
    expect(enemy.animation.releasesRemaining).toBeUndefined();
    expect(burst).not.toHaveBeenCalled();
  });

  it("refreshes a Chort flame target at windup release", () => {
    vi.spyOn(sim.rng, "int").mockReturnValue(1);
    const entity = spawnEnemy(sim, {
      defId: "chort",
      x: spot.x + 2,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    const player = requirePlayer(sim, "p1").entity;
    if (!enemy) throw new Error("missing Chort fixture");

    beginWindup(enemy, {
      targetId: player.id,
      ...player.body,
      spreadX: 0.44,
      spreadY: -0.32,
    });
    player.body.x = enemy.entity.body.x;
    player.body.y = enemy.entity.body.y + 2;
    enemy.animation.ticksRemaining = 0;

    advanceAttackAnimation(sim, enemy, []);

    expect(enemy.animation.releasesRemaining).toBeUndefined();
    expect(enemy.elementalAttack).toEqual(expect.objectContaining({
      cells: expect.arrayContaining([{
        x: Math.floor(player.body.x),
        y: Math.floor(player.body.y),
      }]),
    }));
  });

  it("cancels a windup when its target disconnects outside active AI", () => {
    const entity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1");
    if (!enemy || !player) throw new Error("missing target lifecycle fixture");
    expect(enemy.animation.state).toBe("windup");
    player.connected = false;
    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBeNull();
    expect(enemy.animation.state).toBe("idle");
  });

  it("abandons a dead target and reacquires the nearest living player", () => {
    const living = addEnemyTestPlayer(
      sim,
      { x: spot.x + 3, y: spot.y },
      "p2",
    );
    const entity = spawnEnemy(sim, { defId: "slime", x: spot.x + 1, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const dead = sim.players.get("p1");
    if (!enemy || !dead) throw new Error("missing reacquisition fixture");
    expect(enemy.brain.targetId).toBe(dead.entity.id);
    dead.entity.hp = 0;
    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBe(living.entity.id);
  });

  it("does not acquire a player through a wall", () => {
    sim.world.replaceTileOverrides([{ x: Math.floor(spot.x) + 1, y: Math.floor(spot.y), tile: TILE.CraftingTable }]);
    const entity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x + 2,
      y: spot.y,
    });
    stepEnemies(sim, []);
    expect(sim.enemies.get(entity.id)?.brain.targetId).toBeNull();
  });

});

function requirePlayer(sim: SimState, id: string): PlayerSlot {
  const player = sim.players.get(id);
  if (!player) throw new Error(`missing player fixture: ${id}`);
  return player;
}
