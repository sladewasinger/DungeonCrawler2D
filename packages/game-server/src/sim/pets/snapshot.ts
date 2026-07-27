import type { Entity, EntitySnapshot } from "@dc2d/engine";
import type { SimState } from "../state.js";

/** Pet-only replicated fields; kept outside the general snapshot module so
 * future ability/status fields can grow with the pet subsystem. */
export function petSnapshotFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "petOwnerName"> | Record<string, never> {
  if (entity.kind !== "pet") return {};
  const pet = sim.pets.get(entity.id);
  if (!pet) return {};
  const owner = pet.ownerId ? sim.players.get(pet.ownerId) : undefined;
  const motion = sim.replicationMotion.get(entity.id);
  return {
    anim: motion && Math.hypot(motion.x, motion.y) > 0.05 ? "walk" : "idle",
    ...(owner?.entity.name ? { petOwnerName: owner.entity.name } : {}),
  };
}
