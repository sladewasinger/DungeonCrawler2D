import {
  TICK_DT,
  TORCH_BURN_TICKS,
  createBody,
  faceEntity,
  launchTorch,
  makeEntity,
  newEntityId,
  stepTorch,
} from "@dc2d/engine";
import { invQty, invRemove } from "./inventory.js";
import type { PlayerSlot, SimState } from "./state.js";

/**
 * Throwable torches: the dedicated `throwTorch` intent (direction-aimed,
 * distinct from the generic target-tile `useSlot` throw) through flight,
 * landing, and burnout. Landed torches are their own replicated AOI
 * entity kind ("torch"), not a projectile or ground item.
 */

const TORCH_ITEM = "torch";

/**
 * Throws one torch from inventory toward an aim direction. Rejected
 * outright (no-op) if the player is out of torches, or if the torch
 * item def isn't configured to place — content data is the source of
 * truth, not a hardcoded id check.
 */
export function doThrowTorch(sim: SimState, slot: PlayerSlot, dirX: number, dirY: number): void {
  if (invQty(slot, TORCH_ITEM) < 1) return;
  const def = sim.content.items.get(TORCH_ITEM);
  if (def?.throwable?.placesEntity !== "torch") return;

  const thrower = slot.entity;
  faceEntity(thrower, dirX, dirY);
  const from = { x: thrower.body.x, y: thrower.body.y, z: thrower.body.z + 1 };
  const { vel } = launchTorch(sim.world, from, dirX, dirY);
  const body = createBody(from.x, from.y, from.z);
  body.grounded = false;
  const torch = makeEntity("torch", body, {
    id: newEntityId("t"),
    defId: TORCH_ITEM,
    ownerId: thrower.id,
    torchState: "flying",
    vel,
  });
  sim.torches.set(torch.id, torch);
  invRemove(slot, TORCH_ITEM, 1);
}

/**
 * Integrates every flying torch's arc, starts the burn countdown the
 * tick one lands, and despawns placed torches once that countdown
 * elapses (ASSUMPTION #40: 180s / TORCH_BURN_TICKS from landing).
 */
export function stepTorches(sim: SimState): void {
  for (const [id, torch] of sim.torches) {
    if (torch.torchState === "flying") {
      const result = stepTorch(sim.world, torch, TICK_DT);
      if (result.landed) torch.expiresAtTick = sim.tickCount + TORCH_BURN_TICKS;
      continue;
    }
    if (torch.expiresAtTick !== undefined && sim.tickCount >= torch.expiresAtTick) {
      sim.torches.delete(id);
    }
  }
}
