import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { findSpawn } from "../spawn/spawn.js";
import { addPlayer } from "../players/join.js";
import { createSimState } from "../state/state.js";
import { content } from "../integration/support.js";
import { spawnAdminEntity } from "./adminSpawning.js";
import { authoredServerWorldFixture } from "../testing/finiteWorldTestSupport.js";

describe("admin pet placement", () => {
  it("attaches a pet to its selected owner at the tile centre", () => {
    const sim = petTestState();
    const owner = addPlayer(sim, { name: "Pet owner", clientId: "pet-owner" });
    const point = findSpawn(sim);

    expect(spawnPet(sim, { ...point, ownerPlayerId: "missing-owner" }))
      .toEqual({ ok: false, code: "pet_owner_not_found" });
    expect(sim.pets.size).toBe(0);
    expect(spawnPet(sim, {
      x: Math.floor(point.x) + 0.12,
      y: Math.floor(point.y) + 0.84,
      ownerPlayerId: owner.playerId,
    }).ok).toBe(true);

    const pet = [...sim.pets.values()][0]!;
    expect(pet).toMatchObject({ ownerId: owner.playerId, mode: "following" });
    expect(pet.entity).toMatchObject({ ownerId: owner.playerId });
    expect(pet.entity.body).toMatchObject({
      x: Math.floor(point.x) + 0.5,
      y: Math.floor(point.y) + 0.5,
    });

    sim.replicationMotion.set(pet.entity.id, { x: 1, y: 0 });
    spawnPet(sim, { ...point, ownerPlayerId: owner.playerId, defId: "pet-dog" });

    expect(sim.pets.size).toBe(1);
    expect(sim.replicationMotion.has(pet.entity.id)).toBe(false);
  });
});

function petTestState() {
  return createSimState({
    world: authoredServerWorldFixture(),
    content,
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: {},
  });
}

interface PetSpawnInput {
  readonly x: number;
  readonly y: number;
  readonly ownerPlayerId: string;
  readonly defId?: "pet-dino-tard" | "pet-dog";
}

function spawnPet(sim: ReturnType<typeof petTestState>, input: PetSpawnInput) {
  return spawnAdminEntity(sim, {
    op: "spawn",
    level: "sandbox",
    floor: sim.world.floor,
    kind: "pet",
    defId: input.defId ?? "pet-dino-tard",
    x: input.x,
    y: input.y,
    ownerPlayerId: input.ownerPlayerId,
  });
}
