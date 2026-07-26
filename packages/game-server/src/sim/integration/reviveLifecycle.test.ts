import {
  DOWNED_DURATION,
  PLAYER_MAX_HP,
  RESPAWN_DELAY_TICKS,
  REVIVE_HOLD_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim, stepN, teleport } from "./support.js";

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
    const rescuer = sim.addPlayer("Rescuer", "revive-rescuer");
    const target = sim.addPlayer("Target", "revive-target");
    const rescuerEntity = sim.getPlayerEntity(rescuer.playerId);
    const targetEntity = sim.getPlayerEntity(target.playerId);
    if (!rescuerEntity || !targetEntity) throw new Error("missing revive fixtures");
    teleport(targetEntity, rescuerEntity.body.x + 1, rescuerEntity.body.y, sim);
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
    const rescuer = sim.addPlayer("Rescuer", "cancel-rescuer");
    const target = sim.addPlayer("Target", "cancel-target");
    const rescuerEntity = sim.getPlayerEntity(rescuer.playerId);
    const targetEntity = sim.getPlayerEntity(target.playerId);
    if (!rescuerEntity || !targetEntity) throw new Error("missing cancellation fixtures");
    teleport(targetEntity, rescuerEntity.body.x + 1, rescuerEntity.body.y, sim);
    downPlayer(sim, target.playerId);

    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: true });
    sim.step();
    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: false });
    sim.step();
    stepN(sim, REVIVE_HOLD_TICKS);
    expect(targetEntity.hp).toBe(1);

    sim.queueAction(rescuer.playerId, { type: "revive", targetId: target.playerId, held: true });
    sim.step();
    teleport(rescuerEntity, targetEntity.body.x + 10, targetEntity.body.y, sim);
    stepN(sim, REVIVE_HOLD_TICKS + 1);
    expect(targetEntity.hp).toBe(1);
  });

  it("bleeds out after 30 seconds, then uses the 15-second ordinary respawn", () => {
    const sim = makeSim();
    const target = sim.addPlayer("Target", "timer-target");
    const entity = sim.getPlayerEntity(target.playerId);
    if (!entity) throw new Error("missing timer fixture");
    downPlayer(sim, target.playerId);
    stepN(sim, DOWNED_DURATION * TICK_RATE - 1);
    expect(entity.hp).toBe(1);
    sim.step();
    expect(entity.hp).toBe(0);
    stepN(sim, RESPAWN_DELAY_TICKS);
    expect(entity.hp).toBe(PLAYER_MAX_HP);
  });
});
