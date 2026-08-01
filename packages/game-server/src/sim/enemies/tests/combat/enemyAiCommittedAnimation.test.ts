import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  facePlayerTowardEnemy,
} from "./enemyAiCommittedAnimationSupport.js";

const SPITTER_DEF_ID = "spitter";

describe("committed enemy AI animations", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("does not refresh ranged cooldowns or reservations while windup is committed", () => {
    const enemyEntity = spawnEnemy(sim, { defId: SPITTER_DEF_ID, x: spot.x + 4, y: spot.y });
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

  it("keeps a forced Chort continuation in committed spit with no projectiles", () => {
    vi.spyOn(sim.rng, "int").mockReturnValue(2);
    const enemyEntity = spawnEnemy(sim, { defId: "chort", x: spot.x + 2, y: spot.y });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing Chort burst fixture");

    stepEnemies(sim, []);
    const cooldown = enemy.brain.attackCooldown;
    for (let tick = 0; tick < 5; tick += 1) stepEnemies(sim, []);
    expect(enemy.animation.state).toBe("spit");
    expect(enemy.animation.releasesRemaining).toBe(1);
    expect(enemy.elementalAttack).toBeDefined();
    expect(sim.projectiles.size).toBe(0);

    let sawSecondSweep = false;
    for (let tick = 0; tick < 100 && enemy.animation.state === "spit"; tick += 1) {
      const pendingBefore = enemy.animation.releasesRemaining; stepEnemies(sim, []); sawSecondSweep ||= pendingBefore === 1 && enemy.animation.releasesRemaining === undefined && enemy.elementalAttack !== undefined; expect(enemy.brain.attackCooldown).toBe(cooldown);
    }
    expect(sawSecondSweep).toBe(true);
    expect(enemy.animation.state).toBe("recover");
    expect(sim.projectiles.size).toBe(0);
  });

  it("resolves a settled melee attack through the authoritative block", () => {
    const player = sim.players.get("p1");
    const enemyEntity = spawnEnemy(sim, { defId: "slime", x: spot.x + 0.8, y: spot.y });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!player || !enemy) throw new Error("missing blocked melee fixture");
    player.blocking = true;

    for (let tick = 0; tick < 80; tick += 1) {
      facePlayerTowardEnemy(player.entity, enemy.entity); stepEnemies(sim, []);
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
    if (!firstReservation || firstReservation.kind !== "melee-slot") throw new Error("missing committed melee reservation");
    first.animation = { state: "attack", ticksRemaining: 2 };
    const secondEntity = spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y });
    stepEnemies(sim, []);
    const second = sim.enemies.get(secondEntity.id);
    const secondReservation = second?.attackReservation;
    expect(secondReservation?.kind).toBe("melee-slot");
    expect(`${secondReservation?.x},${secondReservation?.y}`).not.toBe(`${firstReservation.x},${firstReservation.y}`);
  });
});
