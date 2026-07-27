import {
  DOWNED_DURATION,
  PLAYER_MAX_HP,
  RESPAWN_DELAY_TICKS,
  REVIVE_HOLD_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeParty, makeSim, stepN, teleport } from "./support.js";

function downPlayer(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
): void {
  const entity = sim.getPlayerEntity(playerId);
  if (!entity) throw new Error("missing downed fixture");
  entity.hp = 0;
  sim.step();
  expect(entity.hp).toBe(1);
}

describe("authoritative revive lifecycle", () => {
  it("allows an unrelated nearby player to revive after four continuous seconds", () => {
    const sim = makeSim();
    const rescuer = sim.addPlayer({ name: "Rescuer", clientId: "revive-rescuer" });
    const target = sim.addPlayer({ name: "Target", clientId: "revive-target" });
    const rescuerEntity = sim.getPlayerEntity(rescuer.playerId);
    const targetEntity = sim.getPlayerEntity(target.playerId);
    if (!rescuerEntity || !targetEntity) throw new Error("missing revive fixtures");
    teleport({ entity: targetEntity, x: rescuerEntity.body.x + 1, y: rescuerEntity.body.y, sim: sim });
    downPlayer(sim, target.playerId);

    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: true });
    sim.step();
    stepN(sim, REVIVE_HOLD_TICKS - 1);
    expect(targetEntity.hp).toBe(1);
    sim.step();

    expect(targetEntity.hp).toBe(Math.round(PLAYER_MAX_HP * 0.3));
  });

  it("cancels on release and range loss", () => {
    const sim = makeSim();
    const rescuer = sim.addPlayer({ name: "Rescuer", clientId: "cancel-rescuer" });
    const target = sim.addPlayer({ name: "Target", clientId: "cancel-target" });
    const rescuerEntity = sim.getPlayerEntity(rescuer.playerId);
    const targetEntity = sim.getPlayerEntity(target.playerId);
    if (!rescuerEntity || !targetEntity) throw new Error("missing cancellation fixtures");
    teleport({ entity: targetEntity, x: rescuerEntity.body.x + 1, y: rescuerEntity.body.y, sim: sim });
    downPlayer(sim, target.playerId);

    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: true });
    sim.step();
    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: false });
    sim.step();
    stepN(sim, REVIVE_HOLD_TICKS);
    expect(targetEntity.hp).toBe(1);

    const rangeSim = makeSim();
    const rangeRescuer = rangeSim.addPlayer({ name: "Rescuer", clientId: "range-rescuer" });
    const rangeTarget = rangeSim.addPlayer({ name: "Target", clientId: "range-target" });
    const rangeRescuerEntity = rangeSim.getPlayerEntity(rangeRescuer.playerId);
    const rangeTargetEntity = rangeSim.getPlayerEntity(rangeTarget.playerId);
    if (!rangeRescuerEntity || !rangeTargetEntity) throw new Error("missing range fixtures");
    teleport({ entity: rangeTargetEntity, x: rangeRescuerEntity.body.x + 1, y: rangeRescuerEntity.body.y, sim: rangeSim });
    downPlayer(rangeSim, rangeTarget.playerId);
    rangeSim.queueAction(rangeRescuer.playerId, { type: "revive", targetId: rangeTarget.playerId, held: true });
    rangeSim.step();
    teleport({ entity: rangeRescuerEntity, x: rangeTargetEntity.body.x + 10, y: rangeTargetEntity.body.y, sim: rangeSim });
    stepN(rangeSim, REVIVE_HOLD_TICKS + 1);
    expect(rangeTargetEntity.hp).toBe(1);
  });

  it("keeps the revive window at 15 seconds before its ordinary respawn", () => {
    const sim = makeSim();
    const { aId } = makeParty(sim);
    const entity = sim.getPlayerEntity(aId);
    if (!entity) throw new Error("missing timer fixture");
    downPlayer(sim, aId);
    stepN(sim, DOWNED_DURATION * TICK_RATE - 1);
    expect(entity.hp).toBe(1);
    sim.step();
    expect(entity.hp).toBe(0);
    stepN(sim, RESPAWN_DELAY_TICKS);
    expect(entity.hp).toBe(PLAYER_MAX_HP);
  });
});
