import {
  MAX_THROW_RANGE,
  TICK_DT,
  MAX_ACTIVE_TORCHES_PER_FLOOR,
  TORCH_BURN_TICKS,
  type EffectEvent,
  createBody,
  faceEntity,
  launchTorch,
  makeEntity,
  newEntityId,
  stepTorch,
  throwLaunchOrigin,
} from "@dc2d/engine";
import { invQty, invRemove } from "../inventory/inventory.js";
import { ACTIVE_FIRE_TORCH_BURN_TICKS } from "./configuration/torchLifecycleTuning.js";
import { resolveTorchFireContact } from "./torchFireContact.js";
import type { PlayerSlot, SimState } from "../state/state.js";

/**
 * Throwable torches share target selection and ballistics with every thrown
 * item, then diverge at impact into a persistent replicated light entity.
 * The old direction-only intent remains as a compatibility adapter.
 */

const TORCH_ITEM = "torch";

export interface TorchThrow {
  sim: SimState;
  slot: PlayerSlot;
  defId: string;
  targetX: number;
  targetY: number;
}

export interface LegacyTorchThrow {
  sim: SimState;
  slot: PlayerSlot;
  dirX: number;
  dirY: number;
}

/**
 * Throws one torch from inventory toward an absolute target. Rejected
 * outright (no-op) if the player is out of torches, or if the torch
 * item def isn't configured to place — content data is the source of
 * truth, not a hardcoded id check.
 */
export function doThrowTorch({
  sim,
  slot,
  defId,
  targetX,
  targetY,
}: TorchThrow): void {
  if (invQty(slot, defId) < 1) return;
  const def = sim.content.items.get(defId);
  if (def?.throwable?.placesEntity !== "torch") return;
  if (sim.torches.size >= MAX_ACTIVE_TORCHES_PER_FLOOR) {
    slot.outbox.push({ t: "toast", msg: "too many torches burning nearby" });
    return;
  }

  const thrower = slot.entity;
  faceEntity(thrower, targetX - thrower.body.x, targetY - thrower.body.y);
  const from = throwLaunchOrigin(thrower.body);
  const { vel, ballisticFlight } = launchTorch({
    world: sim.world,
    from,
    target: { x: targetX, y: targetY },
  });
  const body = createBody(from.x, from.y, from.z);
  body.grounded = false;
  const torch = makeEntity("torch", body, {
    id: newEntityId("t"),
    defId,
    ownerId: thrower.id,
    torchState: "flying",
    vel,
    ballisticFlight,
  });
  sim.torches.set(torch.id, torch);
  invRemove(slot, defId, 1);
}

/** Converts the retired direction protocol into the target-based contract. */
export function doThrowLegacyTorch({
  sim,
  slot,
  dirX,
  dirY,
}: LegacyTorchThrow): void {
  const length = Math.hypot(dirX, dirY);
  const nx = length > 0 ? dirX / length : 0;
  const ny = length > 0 ? dirY / length : -1;
  doThrowTorch({
    sim,
    slot,
    defId: TORCH_ITEM,
    targetX: slot.entity.body.x + nx * MAX_THROW_RANGE,
    targetY: slot.entity.body.y + ny * MAX_THROW_RANGE,
  });
}

/**
 * Integrates every flying torch's arc, starts the burn countdown the
 * tick one lands, and despawns placed torches once that authoritative countdown
 * elapses. A landing that leaves its cell actively burning gets the shorter,
 * configured burn deadline; every other placed torch retains the normal lifetime.
 */
export function stepTorches(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [id, torch] of sim.torches) {
    if (torch.torchState === "flying") {
      advanceFlyingTorch(sim, torch, effectEvents);
    }
    else removeExpiredTorch(sim, id, torch);
  }
}

function advanceFlyingTorch(
  sim: SimState,
  torch: PlayerSlot["entity"],
  effectEvents: EffectEvent[],
): void {
  resolveTorchFireContact({ sim, torch, effectEvents });
  const result = stepTorch(sim.world, torch, TICK_DT);
  if (!result.landed) return;
  resolveTorchFireContact({ sim, torch, effectEvents, landed: true });
  torch.expiresAtTick = sim.tickCount + torchBurnTicksAtLanding(sim, torch);
}

function torchBurnTicksAtLanding(sim: SimState, torch: PlayerSlot["entity"]): number {
  const x = Math.floor(torch.body.x);
  const y = Math.floor(torch.body.y);
  if (sim.areas.hasTagAt(x, y, "fire")) return ACTIVE_FIRE_TORCH_BURN_TICKS;
  return sim.opts.torchBurnTicks ?? TORCH_BURN_TICKS;
}

function removeExpiredTorch(sim: SimState, id: string, torch: PlayerSlot["entity"]): void {
  clampBurningTorchDeadline(sim, torch);
  if (torch.expiresAtTick !== undefined && sim.tickCount >= torch.expiresAtTick) sim.torches.delete(id);
}

/** A fire that reaches an already placed torch can only shorten its life. */
function clampBurningTorchDeadline(sim: SimState, torch: PlayerSlot["entity"]): void {
  const x = Math.floor(torch.body.x);
  const y = Math.floor(torch.body.y);
  if (!sim.areas.hasTagAt(x, y, "fire")) return;
  const burnDeadline = sim.tickCount + ACTIVE_FIRE_TORCH_BURN_TICKS;
  if (torch.expiresAtTick === undefined || torch.expiresAtTick > burnDeadline) {
    torch.expiresAtTick = burnDeadline;
  }
}
