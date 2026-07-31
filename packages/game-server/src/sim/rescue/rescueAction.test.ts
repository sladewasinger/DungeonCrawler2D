import { CHUNK_SIZE, ROOM_REGION_CY, TICK_RATE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { processActions } from "../actions/index.js";
import { doAttack } from "../actions/melee.js";
import { addPlayer } from "../players/join.js";
import { markDisconnected, queueAction } from "../players/players.js";
import { activeMeleeAttackFor } from "../state/meleeAttackState.js";
import { RESCUE_COOLDOWN_TICKS } from "./configuration/rescueTuning.js";
import { doRescue } from "./rescueAction.js";
import { createRescueFixture, RescueTestWorld } from "./rescueTestSupport.js";

describe("stuck-player rescue action", () => {
  it("relocates safely, resets motion, and starts the configured cooldown", () => {
    const world = new RescueTestWorld();
    world.addPlatform(4, 0, -2);
    const { sim, slot } = createRescueFixture(world);
    sim.tickCount = 100;
    dirtyMovement(slot);

    doRescue(sim, slot);

    expect(slot.entity.body).toMatchObject({
      x: 4.5, y: 0.5, z: -2, zVel: 0, grounded: true, kx: 0, ky: 0,
    });
    expect(slot.pendingInputs).toEqual([]);
    expect(slot.blocking).toBe(false);
    expect(slot.rescueReadyAtTick).toBe(100 + RESCUE_COOLDOWN_TICKS);
    expect(slot.outbox.slice(-2)).toEqual([
      { t: "teleported" },
      { t: "toast", msg: "Rescued to a nearby safe platform." },
    ]);
  });

  it("reports cooldown and keeps the accepted deadline on reconnect", () => {
    const world = new RescueTestWorld();
    world.addPlatform(4, 0);
    const { sim, slot } = createRescueFixture(world);
    doRescue(sim, slot);
    const readyAt = slot.rescueReadyAtTick;
    slot.outbox.length = 0;

    doRescue(sim, slot);
    const cooldownSeconds = Math.ceil(RESCUE_COOLDOWN_TICKS / TICK_RATE);
    expect(slot.outbox).toEqual([{
      t: "toast",
      msg: `Rescue is available again in ${cooldownSeconds}s.`,
    }]);

    markDisconnected(sim, slot.entity.id);
    sim.tickCount += 20;
    const resumed = addPlayer(sim, {
      name: "Tester",
      clientId: slot.clientId,
      resumeToken: slot.resumeToken,
    });
    expect(resumed.resumed).toBe(true);
    expect(sim.players.get(slot.entity.id)).toBe(slot);
    expect(slot.rescueReadyAtTick).toBe(readyAt);
  });

  it("routes dead and downed attempts to rejection toasts", () => {
    const { sim, slot } = createRescueFixture();
    slot.entity.hp = 0;
    queueAndProcessRescue(sim, slot.entity.id);
    expect(slot.outbox.at(-1)).toEqual({
      t: "toast", msg: "You can't use rescue while dead.",
    });

    slot.entity.hp = 1;
    slot.downedAtTick = sim.tickCount;
    queueAndProcessRescue(sim, slot.entity.id);
    expect(slot.outbox.at(-1)).toEqual({
      t: "toast", msg: "You can't use rescue while downed.",
    });
  });

  it("reports when no valid 3×3 destination exists without starting cooldown", () => {
    const { sim, slot } = createRescueFixture();
    doRescue(sim, slot);
    expect(slot.rescueReadyAtTick).toBe(Number.NEGATIVE_INFINITY);
    expect(slot.outbox.at(-1)).toEqual({
      t: "toast", msg: "No nearby flat 3×3 platform is safe enough.",
    });
  });

  it("does not let rescue cross reserved room boundaries", () => {
    const { sim, slot } = createRescueFixture();
    slot.entity.body.y = ROOM_REGION_CY * CHUNK_SIZE + 0.5;

    doRescue(sim, slot);

    expect(slot.rescueReadyAtTick).toBe(Number.NEGATIVE_INFINITY);
    expect(slot.outbox.at(-1)).toEqual({
      t: "toast",
      msg: "Rescue is only available in the dungeon.",
    });
  });

  it("cancels an active melee attack when the rescue is accepted", () => {
    const world = new RescueTestWorld();
    world.addPlatform(4, 0);
    const { sim, slot } = createRescueFixture(world);
    slot.weapon = "sword";
    doAttack({
      sim,
      slot,
      dirX: 1,
      dirY: 0,
      effectEvents: [],
    });
    expect(activeMeleeAttackFor(slot)).toBeDefined();

    doRescue(sim, slot);

    expect(activeMeleeAttackFor(slot)).toBeUndefined();
  });
});

function dirtyMovement(slot: ReturnType<typeof createRescueFixture>["slot"]): void {
  slot.entity.body.zVel = 4;
  slot.entity.body.grounded = false;
  slot.entity.body.kx = 3;
  slot.entity.body.ky = -2;
  slot.blocking = true;
  slot.pendingInputs.push({
    type: "input", seq: 1, projectedServerTick: 1,
    moveX: 1, moveY: 0, jump: true, run: false,
  });
}

function queueAndProcessRescue(
  sim: ReturnType<typeof createRescueFixture>["sim"],
  playerId: string,
): void {
  queueAction(sim, playerId, { type: "rescue" });
  processActions(sim, []);
}
