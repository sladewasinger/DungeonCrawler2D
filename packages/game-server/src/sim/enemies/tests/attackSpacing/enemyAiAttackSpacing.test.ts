import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import { meleeCandidates } from "../../ai/attackSpacing/attackSpacingUtils.js";
import { chooseMeleeSlot } from "../../ai/attackSpacing/meleeSlotSelection.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  asMeleeReservation,
  hasMovedFrom,
  spawnStartPoints,
} from "./attackSpacingTestHelpers.js";

describe("enemy attack spacing", () => {
  let sim: SimState;
  let spot: { x: number; y: number };
  const rangedReservationKind = "ranged-aim";

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("assigns separated firing points for multiple ranged attackers", () => {
    spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    spawnEnemy(sim, { defId: "spitter", x: spot.x + 5, y: spot.y + 0.5 });
    spawnEnemy(sim, { defId: "spitter", x: spot.x + 5, y: spot.y - 0.5 });
    const starters = spawnStartPoints(sim);
    const player = sim.players.get("p1");
    if (!player) throw new Error("missing ranged test player");

    stepEnemies(sim, []);
    const attackers = [...sim.enemies.values()].filter((enemy) =>
      enemy.def.id === "spitter",
    );
    const attackRange = attackers[0]!.def.attack.range;
    expect(attackers.length).toBe(3);
    const slots = new Set(
      attackers.map((enemy) => {
        const reservation = enemy.attackReservation;
        if (!reservation || reservation.kind !== rangedReservationKind) {
          throw new Error("missing ranged reservation");
        }
        const range = Math.hypot(
          reservation.x - player.entity.body.x,
          reservation.y - player.entity.body.y,
        );
        expect(range).toBeGreaterThan(attackRange * 0.8);
        expect(range).toBeLessThanOrEqual(attackRange);
        return `${reservation.x},${reservation.y}`;
      }),
    );
    expect(slots.size).toBeGreaterThan(1);
    expect(attackers.some(hasMovedFrom(starters))).toBe(true);
  });

  it("recomputes melee slot reservations when the target moves", () => {
    const enemyEntity = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 2, y: spot.y });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing melee fixture");
    const player = sim.players.get("p1")?.entity;
    if (!player) throw new Error("missing moving target fixture");

    stepEnemies(sim, []);
    const firstReservation = enemy.attackReservation;
    const meleeFirstReservation = asMeleeReservation(firstReservation);
    expect(meleeCandidates(player, enemy.def.attack.range).some((slot) =>
      slot.x === meleeFirstReservation.x &&
      slot.y === meleeFirstReservation.y &&
      slot.z === meleeFirstReservation.z,
    )).toBe(true);

    player.body.x += 0.4;

    const secondSlot = chooseMeleeSlot({
      sim,
      enemy,
      target: player,
      targetId: player.id,
      attackRange: enemy.def.attack.range,
      occupied: [],
    });
    if (!secondSlot) throw new Error("missing recomputed melee slot");
    expect(meleeCandidates(player, enemy.def.attack.range).some((slot) =>
      slot.x === secondSlot.x && slot.y === secondSlot.y && slot.z === secondSlot.z,
    )).toBe(true);
    expect(
      secondSlot.x !== meleeFirstReservation.x ||
      secondSlot.y !== meleeFirstReservation.y,
    ).toBe(true);
  });

  it("assigns distinct melee approach points for multiple attackers", () => {
    spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    spawnEnemy(sim, { defId: "skeleton", x: spot.x - 0.8, y: spot.y });
    spawnEnemy(sim, { defId: "skeleton", x: spot.x, y: spot.y - 0.8 });
    const starters = spawnStartPoints(sim);

    stepEnemies(sim, []);
    const attackers = [...sim.enemies.values()].filter((enemy) =>
      enemy.def.id === "skeleton",
    );
    const slots = new Set(
      attackers.map((enemy) => {
        const reservation = enemy.attackReservation;
        const meleeReservation = asMeleeReservation(reservation);
        return `${meleeReservation.x},${meleeReservation.y}`;
      }),
    );
    expect(slots.size).toBeGreaterThan(1);
    expect(attackers.some(hasMovedFrom(starters))).toBe(true);
  });

});
