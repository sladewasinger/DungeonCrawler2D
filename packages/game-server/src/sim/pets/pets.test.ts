import { LEVEL, MOVE_SPEED, World, buildContentRegistry, hashString } from "@dc2d/engine";
import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { addPlayer } from "../join.js";
import { resolveSpawnAnchor } from "../spawn.js";
import { createSimState } from "../state.js";
import {
  claimNearestPet,
  PET_DEFINITIONS,
  PET_FOLLOW_DISTANCE_TILES,
  PET_TELEPORT_DISTANCE_TILES,
  seedPets,
  spawnPet,
  stepPets,
} from "./index.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function dungeonState() {
  return createSimState(
    new World(hashString("pet-test-world"), 1, LEVEL.Dungeon),
    content,
    new PlayerStore(null),
    7,
    { spawnRadiusTiles: 2 },
  );
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
    const first = addPlayer(sim, "Ellie", "pet-client-a");
    const second = addPlayer(sim, "Josiah", "pet-client-b");
    const pet = spawnPet(sim, PET_DEFINITIONS[0]!, first.spawn.x + 1, first.spawn.y);
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

  it("allows each player to claim at most one pet", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, "Ellie", "pet-client-one");
    const first = spawnPet(sim, PET_DEFINITIONS[0]!, player.spawn.x + 1, player.spawn.y);
    const second = spawnPet(sim, PET_DEFINITIONS[1]!, player.spawn.x + 2, player.spawn.y);
    const slot = sim.players.get(player.playerId)!;

    expect(claimNearestPet(sim, slot)).toBe(true);
    expect(claimNearestPet(sim, slot)).toBe(true);
    expect(sim.pets.get(first.id)?.ownerId).toBe(player.playerId);
    expect(sim.pets.get(second.id)?.ownerId).toBeNull();
    expect(slot.outbox.at(-1)).toMatchObject({ t: "toast", msg: "You already have a pet." });
  });

  it("does not seed pets on sandbox simulations", () => {
    const sim = createSimState(
      new World(hashString("pet-sandbox"), 1, LEVEL.Sandbox),
      content,
      new PlayerStore(null),
      3,
      {},
    );
    seedPets(sim);
    expect(sim.pets.size).toBe(0);
  });

  it("teleports a claimed pet back near its owner after the leash is exceeded", () => {
    const sim = dungeonState();
    sim.pets.clear();
    const player = addPlayer(sim, "Ellie", "pet-client-teleport");
    const pet = spawnPet(sim, PET_DEFINITIONS[0]!, player.spawn.x + 1, player.spawn.y);
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
    const player = addPlayer(sim, "Ellie", "pet-client-drift-range");
    const pet = spawnPet(sim, PET_DEFINITIONS[0]!, player.spawn.x + 1, player.spawn.y);
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
