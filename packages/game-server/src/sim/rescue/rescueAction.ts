import { TICK_RATE, createBody } from "@dc2d/engine";
import { resetInputTimeline } from "../players/playerInputTimeline.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { RESCUE_COOLDOWN_TICKS } from "./configuration/rescueTuning.js";
import { rescueConstraints } from "./rescueConstraints.js";
import { findRescueDestination } from "./rescueDestination.js";

const DEAD_REJECTION = "You can't use rescue while dead.";
const DOWNED_REJECTION = "You can't use rescue while downed.";
const NO_DESTINATION = "No nearby flat 3×3 platform is safe enough.";

/** Validates and performs the normal production stuck-player rescue action. */
export function doRescue(sim: SimState, slot: PlayerSlot): void {
  if (slot.downedAtTick !== null) return sendToast(slot, DOWNED_REJECTION);
  if (slot.entity.hp <= 0) return sendToast(slot, DEAD_REJECTION);
  const remainingTicks = (slot.rescueReadyAtTick ?? Number.NEGATIVE_INFINITY) -
    sim.tickCount;
  if (remainingTicks > 0) return sendCooldownToast(slot, remainingTicks);
  const constraints = rescueConstraints(sim, slot);
  if (constraints.rejection) return sendToast(slot, constraints.rejection);
  const destination = findRescueDestination({
    world: sim.world,
    from: slot.entity.body,
    allowsTile: constraints.allowsTile,
    isOccupied: constraints.isOccupied,
  });
  if (!destination) return sendToast(slot, NO_DESTINATION);
  slot.rescueReadyAtTick = sim.tickCount + RESCUE_COOLDOWN_TICKS;
  relocatePlayer(sim, slot, destination);
}

function sendCooldownToast(slot: PlayerSlot, remainingTicks: number): void {
  const seconds = Math.ceil(remainingTicks / TICK_RATE);
  sendToast(slot, `Rescue is available again in ${seconds}s.`);
}

function sendToast(slot: PlayerSlot, msg: string): void {
  slot.outbox.push({ t: "toast", msg });
}

function relocatePlayer(
  sim: SimState,
  slot: PlayerSlot,
  destination: { readonly x: number; readonly y: number; readonly z: number },
): void {
  slot.entity.body = createBody(destination.x, destination.y, destination.z);
  slot.blocking = false;
  resetInputTimeline(slot);
  sim.replicationMotion.set(slot.entity.id, { x: 0, y: 0 });
  slot.needsFullAreas = true;
  slot.known.clear();
  slot.outbox.push(
    { t: "teleported" },
    { t: "toast", msg: "Rescued to the nearest safe platform." },
  );
}
