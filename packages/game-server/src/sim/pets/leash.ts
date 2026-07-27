import { createBody } from "@dc2d/engine";
import { findWalkableNear } from "../spawn/spawn.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import type { PetSlot } from "./types.js";

export const PET_FOLLOW_DISTANCE_TILES = 2.2;
/** The catch-up buffer is intentionally generous while pet navigation matures. */
export const PET_TELEPORT_EXTRA_DISTANCE_TILES = 5 * 10;
export const PET_TELEPORT_DISTANCE_TILES = PET_FOLLOW_DISTANCE_TILES + PET_TELEPORT_EXTRA_DISTANCE_TILES;

export function teleportPetNearOwner(sim: SimState, pet: PetSlot, owner: PlayerSlot): void {
  const facing = owner.entity.facing ?? { x: 0, y: 1 };
  const target = findWalkableNear({
    sim,
    x: owner.entity.body.x - facing.x * 1.5,
    y: owner.entity.body.y - facing.y * 1.5,
    maxRadius: 3,
  });
  const x = target ? target.x + 0.5 : owner.entity.body.x - facing.x * 1.25;
  const y = target ? target.y + 0.5 : owner.entity.body.y - facing.y * 1.25;
  pet.entity.body = createBody(x, y, sim.world.groundAt(x, y));
  pet.lastOwnerPosition = { x: owner.entity.body.x, y: owner.entity.body.y };
  pet.ownerStillTicks = 0;
  pet.driftTarget = undefined;
  sim.replicationMotion.set(pet.entity.id, { x: 0, y: 0 });
}
