import {
  INTERACT_RANGE,
  LEVEL,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { findWalkableNear, resolveSpawnAnchor } from "../spawn/spawn.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { clearPetPath } from "./navigation.js";
import { PET_DRIFT_INTERVAL_TICKS, PET_SPAWN_DISTANCE_TILES } from "./behaviorConstants.js";
import { initialPetBehavior, resetPetBehavior } from "./behaviors/scheduler.js";
import { PET_DEFINITIONS, type PetDefinition, type PetSlot } from "./types.js";

export { PET_DRIFT_IDLE_TICKS, PET_DRIFT_INTERVAL_TICKS, PET_SPAWN_DISTANCE_TILES } from "./behaviorConstants.js";
const PET_SPAWN_OFFSETS = [
  { x: 20, y: 0 },
  { x: -24, y: 12 },
  { x: 8, y: -32 },
  { x: 36, y: 24 },
  { x: -40, y: -28 },
] as const;
/** Seed one of each current companion around floor 1's shared spawn area. */
export function seedPets(sim: SimState): void {
  if (!isPetSpawnFloor(sim)) return;
  const anchor = resolveSpawnAnchor(sim);
  const occupied = new Set<string>();
  for (const [index, definition] of PET_DEFINITIONS.entries()) {
    seedPet({ sim, definition, index, anchor, occupied });
  }
}

function isPetSpawnFloor(sim: SimState): boolean {
  return sim.world.floor === 1 && sim.world.level === LEVEL.Dungeon;
}

function seedPet(input: {
  sim: SimState;
  definition: PetDefinition;
  index: number;
  anchor: { x: number; y: number };
  occupied: Set<string>;
}): void {
  const offset = PET_SPAWN_OFFSETS[input.index] ?? { x: PET_SPAWN_DISTANCE_TILES + input.index * 8, y: 0 };
  const spawn = findWalkableNear({ sim: input.sim, x: input.anchor.x + offset.x, y: input.anchor.y + offset.y, maxRadius: input.index === 0 ? 8 : 12, avoid: input.occupied });
  if (!spawn) return;
  input.occupied.add(`${spawn.x},${spawn.y}`);
  spawnPet(input.sim, { definition: input.definition, position: { x: spawn.x + 0.5, y: spawn.y + 0.5 } });
}

export function spawnPet(sim: SimState, input: { definition: PetDefinition; position: { x: number; y: number } }): Entity {
  const entity = createPetEntity(sim, input);
  sim.pets.set(entity.id, petSlot(sim, entity, input));
  return entity;
}

function createPetEntity(sim: SimState, input: { definition: PetDefinition; position: { x: number; y: number } }): Entity {
  const { definition, position } = input;
  return makeEntity("pet", createBody(position.x, position.y, sim.world.groundAt(position.x, position.y)), {
    id: newEntityId("t"),
    defId: definition.id,
    name: definition.name,
    hp: 1,
    maxHp: 1,
    baseSpeed: definition.speed,
    tags: new Set(["pet", "friendly", "organic"]),
    facing: { x: 1, y: 0 },
  });
}

function petSlot(sim: SimState, entity: Entity, input: { definition: PetDefinition; position: { x: number; y: number } }): PetSlot {
  return {
    entity,
    definition: input.definition,
    home: input.position,
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
    behavior: initialPetBehavior(),
  };
}

/** Claims a nearby available pet, releasing the player's previous companion in place. */
export function claimNearestPet(sim: SimState, slot: PlayerSlot): boolean {
  const target = nearestAvailablePet(sim, slot);
  if (!target) return false;
  const previous = ownedPet(sim, slot.entity.id);
  if (previous) releasePet(previous);
  assignPet(target, slot);
  slot.outbox.push({ t: "toast", msg: petClaimMessage(target, previous) });
  return true;
}

function assignPet(target: PetSlot, slot: PlayerSlot): void {
  target.ownerId = slot.entity.id;
  target.mode = "following";
  target.entity.ownerId = slot.entity.id;
  target.lastOwnerPosition = { x: slot.entity.body.x, y: slot.entity.body.y };
  target.ownerStillTicks = 0;
  target.driftTarget = undefined;
  clearPetPath(target);
}
function petClaimMessage(target: PetSlot, previous: PetSlot | undefined): string {
  if (previous) {
    return `${target.definition.name} is now your pet. ${previous.definition.name} is available for another crawler.`;
  }
  return `${target.definition.name} is now your pet! It will follow you around the dungeon.`;
}

function ownedPet(sim: SimState, playerId: string): PetSlot | undefined {
  return [...sim.pets.values()].find((pet) => pet.ownerId === playerId);
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
    if (isCloserPet({ pet, best, distance, bestDistance })) {
      best = pet;
      bestDistance = distance;
    }
  }
  return best;
}

function isCloserPet(input: { pet: PetSlot; best: PetSlot | undefined; distance: number; bestDistance: number }): boolean {
  return input.distance < input.bestDistance
    || (input.distance === input.bestDistance && (!input.best || input.pet.entity.id < input.best.entity.id));
}

export function releasePet(pet: PetSlot): void {
  pet.mode = "available";
  pet.ownerId = null;
  delete pet.entity.ownerId;
  pet.ownerStillTicks = 0;
  pet.driftTarget = undefined;
  resetPetBehavior(pet);
  clearPetPath(pet);
}
