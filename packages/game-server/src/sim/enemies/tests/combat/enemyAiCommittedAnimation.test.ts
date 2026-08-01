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
  advanceFirstRangedRelease,
  advancePendingRangedRelease,
  advancePostRecoveryThinking,
  advanceRangedRecovery,
  expectRangedPayload,
} from "./enemyAiCommittedAnimationSupport.js";

const SPITTER_DEF_ID = "spitter";
const ORC_SHAMAN_DEF_ID = "orc-shaman";

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

  it.each([
    [SPITTER_DEF_ID, 1], [SPITTER_DEF_ID, 2],
    [ORC_SHAMAN_DEF_ID, 1], [ORC_SHAMAN_DEF_ID, 2],
  ] as const)("%s releases exactly %d projectiles with its payload", (defId, length) => {
    vi.spyOn(sim.rng, "int").mockReturnValue(length);
    const enemyEntity = spawnEnemy(sim, {
      defId,
      x: spot.x + 4,
      y: spot.y,
    });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error(`missing ${defId} fixture`);

    advanceFirstRangedRelease(sim);
    const cooldown = enemy.brain.attackCooldown;
    expect(enemy.animation.state).toBe("spit");
    expect(enemy.animation.releasesRemaining).toBe(length === 2 ? 1 : undefined);
    expect(enemy.brain.attackCooldown).toBe(cooldown);
    expect(sim.projectiles.size).toBe(1);
    if (length === 2) {
      advancePendingRangedRelease(sim); expect(sim.projectiles.size).toBe(2);
      expect(enemy.animation.releasesRemaining).toBeUndefined();
    }
    expectRangedPayload(sim, enemy, enemyEntity.id);
    advanceRangedRecovery(sim);
    expect(enemy.brain.attackCooldown).toBe(cooldown);
    advancePostRecoveryThinking(sim, enemy, cooldown);
    expect(enemy.brain.attackCooldown).toBeLessThan(cooldown);
    expect(enemy.animation.state).not.toBe("windup");
  });

  it.each([SPITTER_DEF_ID, ORC_SHAMAN_DEF_ID] as const)(
    "%s cancels a pending release after target invalidation",
    (defId) => {
      vi.spyOn(sim.rng, "int").mockReturnValue(2);
      const entity = spawnEnemy(sim, { defId, x: spot.x + 4, y: spot.y });
      const enemy = sim.enemies.get(entity.id);
      const player = sim.players.get("p1");
      if (!enemy || !player) throw new Error(`missing ${defId} target`);
      advanceFirstRangedRelease(sim);
      player.connected = false;
      enemy.animation.ticksRemaining = 0;
      stepEnemies(sim, []);
      expect(sim.projectiles.size).toBe(1);
      expect(enemy.animation.state).toBe("recover");
    },
  );

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
      const pendingBefore = enemy.animation.releasesRemaining; stepEnemies(sim, []);
      sawSecondSweep ||= pendingBefore === 1 && enemy.animation.releasesRemaining === undefined && enemy.elementalAttack !== undefined;
      expect(enemy.brain.attackCooldown).toBe(cooldown);
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
    expect(`${secondReservation?.x},${secondReservation?.y}`).not.toBe(`${firstReservation.x},${firstReservation.y}`);
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
