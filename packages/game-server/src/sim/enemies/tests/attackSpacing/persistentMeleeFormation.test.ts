import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  meleeCandidates,
} from "../../ai/attackSpacing/attackSpacingUtils.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  asMeleeReservation,
  enemiesAreSeparated,
  requireEnemy,
  reservationsRemainStable,
} from "./attackSpacingTestHelpers.js";

describe("persistent melee formations", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("retains three goblin slots across cooldown and animation cycles", () => {
    const entities = [
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2, y: spot.y }),
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2.4, y: spot.y + 0.4 }),
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2.4, y: spot.y - 0.4 }),
    ];
    const reservations = new Map<string, string>();
    for (let tick = 0; tick < 70; tick += 1) {
      stepEnemies(sim, []);
      if (tick >= 15) {
        const current = entities.map((entity) => requireEnemy(sim, entity.id));
        expect(enemiesAreSeparated(current)).toBe(true);
      }
      expect(reservationsRemainStable(sim, entities, reservations)).toBe(true);
    }
    expect(new Set(reservations.values()).size).toBe(3);
  });

  it("lands melee damage after a formation settles", () => {
    const entity = spawnEnemy(sim, { defId: "slime", x: spot.x, y: spot.y });
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1")?.entity;
    if (!enemy || !player) throw new Error("missing damage fixture");

    for (let tick = 0; tick < 80; tick += 1) stepEnemies(sim, []);

    expect(player.hp).toBeLessThan(player.maxHp);
  });

  it("keeps committed ranged directions occupied", () => {
    const firstEntity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    const first = sim.enemies.get(firstEntity.id);
    if (!first) throw new Error("missing committed ranged attacker");
    stepEnemies(sim, []);
    const firstReservation = first.attackReservation;
    if (!firstReservation || firstReservation.kind !== "ranged-aim") {
      throw new Error("missing ranged reservation");
    }
    first.animation = { state: "windup", ticksRemaining: 2 };
    const secondEntity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y + 0.5 });
    stepEnemies(sim, []);

    const secondReservation = sim.enemies.get(secondEntity.id)?.attackReservation;
    if (!secondReservation || secondReservation.kind !== "ranged-aim") {
      throw new Error("missing second ranged reservation");
    }
    expect(`${secondReservation.directionX},${secondReservation.directionY}`).not.toBe(
      `${firstReservation.directionX},${firstReservation.directionY}`,
    );
  });

  it("reacquires a translated slot after the target moves", () => {
    const entity = spawnEnemy(sim, { defId: "goblin", x: spot.x + 3, y: spot.y });
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1")?.entity;
    if (!enemy || !player) throw new Error("missing moving-target fixture");
    stepEnemies(sim, []);
    const first = asMeleeReservation(enemy.attackReservation);
    player.body.x += 0.5;
    stepEnemies(sim, []);
    const second = asMeleeReservation(enemy.attackReservation);
    expect(second.targetId).toBe(player.id);
    expect(second.x !== first.x || second.y !== first.y).toBe(true);
  });

  it("gives a short-range slime a non-center slot", () => {
    const entity = spawnEnemy(sim, { defId: "slime", x: spot.x + 1.5, y: spot.y });
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1")?.entity;
    if (!enemy || !player) throw new Error("missing slime fixture");
    stepEnemies(sim, []);
    const reservation = asMeleeReservation(enemy.attackReservation);
    expect(meleeCandidates(player, enemy.def.attack.range).some((candidate) =>
      candidate.x === reservation.x &&
      candidate.y === reservation.y &&
      candidate.z === reservation.z,
    )).toBe(true);
    expect(reservation.x !== player.body.x || reservation.y !== player.body.y).toBe(true);
  });

  it("does not consume cooldown while positioning a suppressed strike", () => {
    const entity = spawnEnemy(sim, { defId: "goblin", x: spot.x + 1.8, y: spot.y });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing positioning fixture");
    stepEnemies(sim, []);
    expect(enemy.animation.state).not.toBe("attack");
    expect(enemy.brain.attackCooldown).toBe(0);
  });

  it("keeps settled attackers apart while staggered attacks continue", () => {
    const entities = [
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2, y: spot.y }),
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2.4, y: spot.y + 0.4 }),
      spawnEnemy(sim, { defId: "goblin", x: spot.x + 2.4, y: spot.y - 0.4 }),
    ];
    for (let tick = 0; tick < 70; tick += 1) stepEnemies(sim, []);
    expect(enemiesAreSeparated(entities.map((entity) => requireEnemy(sim, entity.id)))).toBe(true);
  });
});
