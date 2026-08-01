import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { retainedMeleeSlotOccupants } from "../../ai/attackSpacing/retainedAttackOccupancy.js";
import {
  meleeCandidates,
  slotWalkable,
} from "../../ai/attackSpacing/attackSpacingUtils.js";
import { isUsableCandidate } from "../../ai/attackSpacing/meleeSlotSelectionHelpers.js";
import { setMeleeReservation } from "../../ai/helpers/meleeReservationState.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";

interface SlotCommitInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly targetId: string;
  readonly slot: { x: number; y: number; z: number };
}

describe("retained attack occupancy", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("retains every committed enemy sharing one melee slot", () => {
    const player = sim.players.get("p1")?.entity;
    if (!player) throw new Error("missing shared-slot player");
    const firstEntity = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    const first = sim.enemies.get(firstEntity.id);
    if (!first) throw new Error("missing first shared-slot enemy");
    const slot = meleeCandidates(player, first.def.attack.range).find((candidate) =>
      !candidate.canShare && isUsableCandidate({
        sim,
        enemy: first,
        target: player,
        targetId: player.id,
        attackRange: first.def.attack.range,
        occupied: [],
      }, candidate, { policy: "bounded-fallback" }),
    );
    if (!slot) throw new Error("missing shared melee slot");
    const secondEntity = spawnEnemy(sim, { defId: "skeleton", x: slot.x, y: slot.y });
    const second = sim.enemies.get(secondEntity.id);
    if (!second) throw new Error("missing second shared-slot enemy");
    placeAtSlot(first, slot);
    placeAtSlot(second, slot);
    if (!slotWalkable(sim, first, slot)) throw new Error("shared slot is not walkable");
    for (const enemy of [first, second]) {
      commitSlot({ sim, enemy, targetId: player.id, slot });
    }

    const occupants = retainedMeleeSlotOccupants({
      sim,
      enemies: [first, second],
      targets: new Map([
        [first.entity.id, player],
        [second.entity.id, player],
      ]),
      targetId: player.id,
    });

    expect(occupants).toHaveLength(2);
    expect(occupants.map((occupant) => occupant.enemy.entity.id)).toEqual([
      firstEntity.id,
      secondEntity.id,
    ]);
  });
});

function placeAtSlot(enemy: EnemySlot, slot: { x: number; y: number; z: number }): void {
  enemy.entity.body.x = slot.x;
  enemy.entity.body.y = slot.y;
  enemy.entity.body.z = slot.z;
}

function commitSlot(input: SlotCommitInput): void {
  input.enemy.animation = { state: "attack", ticksRemaining: 2 };
  setMeleeReservation(input.sim, input.enemy, {
    targetId: input.targetId,
    slot: {
      ...input.slot,
      canShare: false,
    },
  });
}
