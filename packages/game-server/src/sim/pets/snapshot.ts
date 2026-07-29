import type { Entity, EntitySnapshot } from "@dc2d/engine";
import type { SimState } from "../state/state.js";

/** Pet-only replicated fields; kept outside the general snapshot module so
 * future ability/status fields can grow with the pet subsystem. */
export function petSnapshotFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "petOwnerName"> | Record<string, never> {
  if (entity.kind !== "pet") return {};
  const pet = sim.pets.get(entity.id);
  if (!pet) return {};
  return {
    anim: petAnimation(sim, entity.id),
    ...petOwnerName(sim, pet.ownerId),
  };
}

function petAnimation(sim: SimState, id: string): "walk" | "idle" {
  const motion = sim.replicationMotion.get(id);
  return motion && Math.hypot(motion.x, motion.y) > 0.05 ? "walk" : "idle";
}

function petOwnerName(sim: SimState, ownerId: string | null): Pick<EntitySnapshot, "petOwnerName"> {
  const name = ownerId ? sim.players.get(ownerId)?.entity.name : undefined;
  return name ? { petOwnerName: name } : {};
}
