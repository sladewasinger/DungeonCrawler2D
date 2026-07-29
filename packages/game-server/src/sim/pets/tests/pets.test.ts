import { LEVEL, MOVE_SPEED, World, buildContentRegistry, hashString } from "@dc2d/engine";
import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { addPlayer } from "../../players/join.js";
import { resolveSpawnAnchor } from "../../spawn/spawn.js";
import { createSimState } from "../../state/state.js";
import {
  claimNearestPet,
  PET_DEFINITIONS,
  PET_FOLLOW_DISTANCE_TILES,
  PET_TELEPORT_DISTANCE_TILES,
  seedPets,
  spawnPet,
  stepPets,
} from "../index.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function dungeonState() {
  return createSimState({
    world: new World(hashString("pet-test-world"), 1, LEVEL.Dungeon),
    content, store: new PlayerStore(null), rngSeed: 7, opts: { spawnRadiusTiles: 2 },
  });
}

describe("pets", () => {
  it("uses the shared player movement speed", () => {
    expect(PET_DEFINITIONS.every((definition) => definition.speed === MOVE_SPEED)).toBe(true);
  });

  it("seeds one of each pet around the shared spawn anchor", () => {
    const sim = dungeonState();
    expect(sim.pets.size).toBe(PET_DEFINITIONS.length);
    const pets = [...sim.pets.values()];
    const anchor = resolveSpawnAnchor(sim);
    const distances = pets.map((pet) => Math.hypot(pet.entity.body.x - anchor.x, pet.entity.body.y - anchor.y));
    expect(distances.some((distance) => distance > 10 && distance < 30)).toBe(true);
    expect(new Set(pets.map((pet) => `${pet.entity.body.x},${pet.entity.body.y}`)).size).toBe(pets.length);
  });

  it("lets only the first nearby player claim a pet, then follows their movement", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const first = addPlayer(sim, { name: "Ellie", clientId: "pet-client-a" });
    const second = addPlayer(sim, { name: "Josiah", clientId: "pet-client-b" });
    const pet = spawnPet(sim, { definition: PET_DEFINITIONS[0]!, position: { x: first.spawn.x + 1, y: first.spawn.y } });
    const secondSlot = sim.players.get(second.playerId)!;
    secondSlot.entity.body.x = pet.body.x;
    secondSlot.entity.body.y = pet.body.y;
    expect(claimNearestPet(sim, sim.players.get(first.playerId)!)).toBe(true);
    expect(claimNearestPet(sim, secondSlot)).toBe(false);
    expect(sim.pets.get(pet.id)?.ownerId).toBe(first.playerId);
    expect(sim.players.get(first.playerId)!.outbox.at(-1)).toMatchObject({ t: "toast" });

    const owner = sim.players.get(first.playerId)!;
    const before = pet.body.x;
    owner.entity.body.x += 5;
    stepPets(sim);
    expect(pet.body.x).toBeGreaterThan(before);
  });

  it("swaps pets and leaves the previous companion available in place", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, { name: "Ellie", clientId: "pet-client-one" });
    const first = spawnPet(sim, { definition: PET_DEFINITIONS[0]!, position: { x: player.spawn.x + 1, y: player.spawn.y } });
    const second = spawnPet(sim, { definition: PET_DEFINITIONS[1]!, position: { x: player.spawn.x + 4, y: player.spawn.y } });
    const slot = sim.players.get(player.playerId)!;

    expect(claimNearestPet(sim, slot)).toBe(true);
    const firstPosition = { x: first.body.x, y: first.body.y };
    slot.entity.body.x = second.body.x;
    expect(claimNearestPet(sim, slot)).toBe(true);
    expect(sim.pets.get(first.id)).toMatchObject({ ownerId: null, mode: "available" });
    expect(first.body).toMatchObject(firstPosition);
    expect(sim.pets.get(second.id)?.ownerId).toBe(player.playerId);
    expect(slot.outbox.at(-1)).toMatchObject({
      t: "toast",
      msg: "Mort is now your pet. Doux is available for another crawler.",
    });
  });

  it("does not consume interact when only the player's own pet is nearby", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, { name: "Ellie", clientId: "pet-client-self" });
    spawnPet(sim, { definition: PET_DEFINITIONS[0]!, position: { x: player.spawn.x + 1, y: player.spawn.y } });
    const slot = sim.players.get(player.playerId)!;
    expect(claimNearestPet(sim, slot)).toBe(true);
    slot.outbox.length = 0;

    expect(claimNearestPet(sim, slot)).toBe(false);
    expect(slot.outbox).toEqual([]);
  });

  it("does not seed pets on sandbox simulations", () => {
    const sim = createSimState({
      world: new World(hashString("pet-sandbox"), 1, LEVEL.Sandbox),
      content, store: new PlayerStore(null), rngSeed: 3, opts: {},
    });
    seedPets(sim);
    expect(sim.pets.size).toBe(0);
  });

  it("teleports a claimed pet back near its owner after the leash is exceeded", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, { name: "Ellie", clientId: "pet-client-teleport" });
    const pet = spawnPet(sim, { definition: PET_DEFINITIONS[0]!, position: { x: player.spawn.x + 1, y: player.spawn.y } });
    const slot = sim.players.get(player.playerId)!;
    expect(claimNearestPet(sim, slot)).toBe(true);
    slot.entity.body.x = pet.body.x + PET_TELEPORT_DISTANCE_TILES + 1;
    stepPets(sim);
    expect(Math.hypot(
      pet.body.x - slot.entity.body.x,
      pet.body.y - slot.entity.body.y,
    )).toBeLessThan(PET_FOLLOW_DISTANCE_TILES + 2);
  });

  it("drops an idle drift target that falls outside the follow leash", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, { name: "Ellie", clientId: "pet-client-drift-range" });
    const pet = spawnPet(sim, { definition: PET_DEFINITIONS[0]!, position: { x: player.spawn.x + 1, y: player.spawn.y } });
    const slot = sim.players.get(player.playerId)!;
    expect(claimNearestPet(sim, slot)).toBe(true);
    const petSlot = sim.pets.get(pet.id)!;
    petSlot.driftTarget = {
      x: slot.entity.body.x + PET_FOLLOW_DISTANCE_TILES + 1,
      y: slot.entity.body.y,
    };

    stepPets(sim);

    expect(petSlot.driftTarget).toBeUndefined();
  });
});
