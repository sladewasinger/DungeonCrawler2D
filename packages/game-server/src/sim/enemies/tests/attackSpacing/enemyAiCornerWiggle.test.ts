import { beforeEach, describe, expect, it } from "vitest";
import { meleeCandidates, slotWalkable } from "../../ai/attackSpacing/attackSpacingUtils.js";
import { isUsableCandidate } from "../../ai/attackSpacing/meleeSlotSelectionHelpers.js";
import { pruneInvalidReservations } from "../../ai/attackSpacing/retainedAttackOccupancy.js";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  applySteppedCorner,
  hasAxisReversal,
  requireCornerEnemy,
  requireCornerPlayer,
  settleCorner,
} from "./enemyAiCornerWiggleTestSupport.js";

describe("enemy melee stepped-wall corner", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
    applySteppedCorner(sim, spot);
  });

  it("rejects the wall-facing slot while retaining an open-side option", () => {
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x - 2,
      y: spot.y,
    });
    const enemy = requireCornerEnemy(sim, enemyEntity.id);
    const player = requireCornerPlayer(sim).entity;
    const candidates = meleeCandidates(player, enemy.def.attack.range);
    const wallFacing = candidates.find((candidate) =>
      candidate.x > player.body.x && Math.abs(candidate.y - player.body.y) < 0.2,
    );
    const openSide = candidates.find((candidate) =>
      candidate.x < player.body.x && Math.abs(candidate.y - player.body.y) < 0.2,
    );

    expect(wallFacing).toBeDefined();
    expect(openSide).toBeDefined();
    if (!wallFacing || !openSide) return;
    expect(slotWalkable(sim, enemy, wallFacing)).toBe(false);
    expect(slotWalkable(sim, enemy, openSide)).toBe(true);
  });

  it("rejects a z1 front slot against a z0 player even when the body can stand there", () => {
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x - 2,
      y: spot.y,
    });
    const enemy = requireCornerEnemy(sim, enemyEntity.id);
    const player = requireCornerPlayer(sim).entity;
    const candidate = meleeCandidates(player, enemy.def.attack.range).find((slot) =>
      slot.x > player.body.x && Math.abs(slot.y - player.body.y) < 0.2,
    );
    if (!candidate) throw new Error("missing stepped front candidate");
    enemy.entity.body.z += 1;

    expect(slotWalkable(sim, enemy, candidate)).toBe(true);
    expect(isUsableCandidate({
      sim,
      enemy,
      target: player,
      targetId: player.id,
      attackRange: enemy.def.attack.range,
      occupied: [],
    }, candidate, { policy: "exclusive" })).toBe(false);
  });

  it("settles without reversal, keeps its slot stable, and still attacks", () => {
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x - 2,
      y: spot.y,
    });
    const enemy = requireCornerEnemy(sim, enemyEntity.id);
    const player = requireCornerPlayer(sim).entity;
    const settlement = settleCorner({ sim, enemy, player });

    expect(settlement.reservations.size).toBeLessThanOrEqual(1);
    if (settlement.holding) {
      expect(enemy.attackReservation).toBeUndefined();
    } else {
      expect(settlement.reservations.size).toBe(1);
      expect(settlement.progressed).toBe(true);
    }
    expect(hasAxisReversal(settlement.positions.slice(20))).toBe(false);
    expect(player.hp).toBeLessThan(player.maxHp);
  });
  it("drops a committed slot when the target-relative candidate becomes stale", () => {
    const enemyEntity = spawnEnemy(sim, {
      defId: "skeleton",
      x: spot.x - 0.8,
      y: spot.y,
    });
    const enemy = requireCornerEnemy(sim, enemyEntity.id);
    const player = requireCornerPlayer(sim).entity;
    stepEnemies(sim, []);
    if (!enemy.attackReservation) throw new Error("missing stale reservation");
    enemy.animation = { state: "attack", ticksRemaining: 2 };
    player.body.x += 1;

    pruneInvalidReservations({
      sim,
      enemies: [enemy],
      targets: new Map([[enemy.entity.id, player]]),
    });

    expect(enemy.attackReservation).toBeUndefined();
    expect(enemy.meleeFormation).toBeUndefined();
  });
});
