import {
  INTERACT_RANGE,
  LEVEL,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { findWalkableNear, resolveSpawnAnchor } from "../spawn.js";
import type { PlayerSlot, SimState } from "../state.js";
import { stepPetTowardOwner } from "./follow.js";
import { clearPetPath } from "./navigation.js";
import { PET_DRIFT_INTERVAL_TICKS, PET_SPAWN_DISTANCE_TILES } from "./behaviorConstants.js";
import { PET_DEFINITIONS, type PetDefinition, type PetSlot } from "./types.js";

export { PET_DRIFT_IDLE_TICKS, PET_DRIFT_INTERVAL_TICKS, PET_SPAWN_DISTANCE_TILES } from "./behaviorConstants.js";

/** Seed the initial pet population once per floor sim. The first pet is near
 * the shared spawn anchor; additional pets can use the same seam later. */
export function seedPets(sim: SimState): void {
  if (sim.world.floor !== 1 || sim.world.level !== LEVEL.Dungeon) return;
  const anchor = resolveSpawnAnchor(sim);
  const spawn = findWalkableNear(
    sim,
    anchor.x + PET_SPAWN_DISTANCE_TILES,
    anchor.y,
    8,
  );
  if (!spawn) return;
  const definition = PET_DEFINITIONS[Math.floor(sim.rng.next() * PET_DEFINITIONS.length)] ?? PET_DEFINITIONS[0]!;
  spawnPet(sim, definition, spawn.x + 0.5, spawn.y + 0.5);
}

export function spawnPet(
  sim: SimState,
  definition: PetDefinition,
  x: number,
  y: number,
): Entity {
  const entity = makeEntity("pet", createBody(x, y, sim.world.groundAt(x, y)), {
    id: newEntityId("t"),
    defId: definition.id,
    name: definition.name,
    hp: 1,
    maxHp: 1,
    baseSpeed: definition.speed,
    tags: new Set(["pet", "friendly", "organic"]),
    facing: { x: 1, y: 0 },
  });
  sim.pets.set(entity.id, {
    entity,
    definition,
    home: { x, y },
    ownerId: null,
    mode: "available",
    abilities: { attack: false, collectLoot: false },
    ownerStillTicks: 0,
    lastOwnerPosition: undefined,
    driftTarget: undefined,
    nextDriftTick: sim.tickCount + PET_DRIFT_INTERVAL_TICKS,
    path: [],
    pathIndex: 0,
    nextPathTick: sim.tickCount,
    pathGoal: undefined,
  });
  return entity;
}

/** The first nearby player to send interact owns an unclaimed pet. */
export function claimNearestPet(sim: SimState, slot: PlayerSlot): boolean {
  const target = nearestAvailablePet(sim, slot);
  if (!target) return false;
  target.ownerId = slot.entity.id;
  target.mode = "following";
  target.entity.ownerId = slot.entity.id;
  target.lastOwnerPosition = { x: slot.entity.body.x, y: slot.entity.body.y };
  target.ownerStillTicks = 0;
  target.driftTarget = undefined;
  clearPetPath(target);
  slot.outbox.push({
    t: "toast",
    msg: `${target.definition.name} is now your pet! It will follow you around the dungeon.`,
  });
  return true;
}

function nearestAvailablePet(sim: SimState, slot: PlayerSlot): PetSlot | undefined {
  let best: PetSlot | undefined;
  let bestDistance = INTERACT_RANGE;
  for (const pet of sim.pets.values()) {
    if (pet.ownerId !== null) continue;
    const distance = Math.hypot(
      pet.entity.body.x - slot.entity.body.x,
      pet.entity.body.y - slot.entity.body.y,
    );
    if (distance < bestDistance ||
      (distance === bestDistance && (!best || pet.entity.id < best.entity.id))) {
      best = pet;
      bestDistance = distance;
    }
  }
  return best;
}

export function stepPets(sim: SimState): void {
  for (const pet of sim.pets.values()) {
    sim.replicationMotion.set(pet.entity.id, { x: 0, y: 0 });
    const owner = pet.ownerId ? sim.players.get(pet.ownerId) : undefined;
    if (!owner) {
      pet.mode = "available";
      pet.ownerId = null;
      delete pet.entity.ownerId;
      pet.ownerStillTicks = 0;
      pet.driftTarget = undefined;
      clearPetPath(pet);
      continue;
    }
    if (!owner.connected || owner.entity.hp <= 0) continue;
    pet.mode = "following";
    stepPetTowardOwner(sim, pet, owner);
  }
}
