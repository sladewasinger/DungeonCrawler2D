import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";

describe("committed enemy AI animations", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("does not refresh ranged cooldowns or reservations while windup is committed", () => {
    const enemyEntity = spawnEnemy(sim, {
      defId: "spitter",
      x: spot.x + 4,
      y: spot.y,
    });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing spitter fixture");
    expect(enemy.animation.state).toBe("windup");
    const windupReservation = enemy.attackReservation;
    const windupCooldown = enemy.brain.attackCooldown;

    stepEnemies(sim, []);

    expect(enemy.animation.state).toBe("windup");
    expect(enemy.brain.attackCooldown).toBe(windupCooldown);
    expect(enemy.attackReservation).toEqual(windupReservation);
  });

  it("resolves a settled melee attack through the authoritative block", () => {
    const player = sim.players.get("p1");
    const enemyEntity = spawnEnemy(sim, {
      defId: "slime",
      x: spot.x + 0.8,
      y: spot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!player || !enemy) throw new Error("missing blocked melee fixture");
    player.blocking = true;

    for (let tick = 0; tick < 80; tick += 1) {
      facePlayerTowardEnemy(player.entity, enemy.entity);
      stepEnemies(sim, []);
    }

    expect(player.entity.hp).toBe(player.entity.maxHp);
    expect(player.outbox).toContainEqual({ t: "blockFeedback", kind: "melee" });
  });

  it("keeps a committed melee slot occupied for another attacker", () => {
    const firstEntity = spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y });
    const first = sim.enemies.get(firstEntity.id);
    if (!first) throw new Error("missing committed attacker");
    stepEnemies(sim, []);
    const firstReservation = first.attackReservation;
    if (!firstReservation || firstReservation.kind !== "melee-slot") {
      throw new Error("missing committed melee reservation");
    }
    first.animation = { state: "attack", ticksRemaining: 2 };
    const secondEntity = spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y });
    stepEnemies(sim, []);
    const second = sim.enemies.get(secondEntity.id);
    const secondReservation = second?.attackReservation;
    expect(secondReservation?.kind).toBe("melee-slot");
    expect(`${secondReservation?.x},${secondReservation?.y}`).not.toBe(
      `${firstReservation.x},${firstReservation.y}`,
    );
  });
});

function facePlayerTowardEnemy(
  player: { body: { x: number; y: number }; facing?: { x: number; y: number } },
  enemy: { body: { x: number; y: number } },
): void {
  const dx = enemy.body.x - player.body.x;
  const dy = enemy.body.y - player.body.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) player.facing = { x: dx / length, y: dy / length };
}
