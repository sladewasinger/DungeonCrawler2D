import {
  CHUNK_SIZE,
  FEATURE_FACE,
  LEVEL,
  TERRAIN,
  TILE,
  World,
  buildContentRegistry,
  createBody,
  hashString,
} from "@dc2d/engine";
import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { addPlayer } from "../../players/join.js";
import { createSimState } from "../../state/state.js";
import {
  PET_DEFINITIONS,
  claimNearestPet,
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
describe("pet airborne physics", () => {
  it("lands after follow steering stops below a stationary owner", () => {
    const sim = petPhysicsState();
    const owner = addPlayer(sim, {
      name: "Owner",
      clientId: "pet-airborne-owner",
    });
    const slot = sim.players.get(owner.playerId)!;
    const petEntity = spawnPet(sim, {
      definition: PET_DEFINITIONS[0]!,
      position: { x: slot.entity.body.x + 1, y: slot.entity.body.y },
    });
    expect(claimNearestPet(sim, slot)).toBe(true);
    const pet = sim.pets.get(petEntity.id)!;
    prepareLedgePursuit(sim.world, slot.entity.body, pet.entity.body);
    pet.path = [{
      x: slot.entity.body.x,
      y: slot.entity.body.y,
      jump: true,
    }];
    pet.pathGoal = {
      x: Math.floor(slot.entity.body.x),
      y: Math.floor(slot.entity.body.y),
    };
    pet.nextPathTick = sim.tickCount + 200;
    pet.lastOwnerPosition = {
      x: slot.entity.body.x,
      y: slot.entity.body.y,
    };

    stepPets(sim);
    expect(pet.entity.body.grounded).toBe(false);
    expect(pet.entity.body.zVel).toBeGreaterThan(0);

    const ownerPosition = { x: slot.entity.body.x, y: slot.entity.body.y };
    const flight = finishPetFlight(sim, pet.entity.body);
    expect(flight.sawDescent).toBe(true);
    expect(flight.maximumZ).toBeGreaterThan(1);
    expect(pet.entity.body.grounded).toBe(true);
    expect(pet.entity.body.z).toBeCloseTo(1);
    expect(slot.entity.body).toMatchObject(ownerPosition);
  });
});

function petPhysicsState() {
  const world = new World(hashString("pet-airborne-physics"), 1, LEVEL.Dungeon);
  const sim = createSimState({
    world,
    content,
    store: new PlayerStore(null),
    rngSeed: 12,
    opts: { spawnRadiusTiles: 2 },
  });
  sim.pets.clear();
  return sim;
}

function prepareLedgePursuit(
  world: World,
  ownerBody: { x: number; y: number; z: number },
  petBody: { x: number; y: number; z: number },
): void {
  const y = 8;
  for (let tileY = y - 1; tileY <= y + 1; tileY++) {
    for (let tileX = 8; tileX <= 12; tileX++) {
      setTestFloor({
        world,
        x: tileX,
        y: tileY,
        height: tileX >= 10 ? 1 : 0,
      });
    }
  }
  Object.assign(ownerBody, createBody(10.5, y + 0.5, 1));
  Object.assign(petBody, createBody(8.5, y + 0.5, 0));
}

function setTestFloor(input: {
  readonly world: World;
  readonly x: number;
  readonly y: number;
  readonly height: number;
}): void {
  const { world, x, y, height } = input;
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  const chunk = world.getChunk(cx, cy);
  const index = ly * CHUNK_SIZE + lx;
  chunk.tiles[index] = TILE.Floor;
  chunk.terrain[index] = TERRAIN.Floor;
  chunk.features[index] = TILE.Floor;
  chunk.featureFaces[index] = FEATURE_FACE.Top;
  chunk.featureHeight[index] = 0;
  chunk.height[index] = height;
}

function finishPetFlight(
  sim: ReturnType<typeof petPhysicsState>,
  body: { grounded: boolean; z: number; zVel: number },
): { sawDescent: boolean; maximumZ: number } {
  let sawDescent = false;
  let maximumZ = body.z;
  for (let tick = 0; tick < 100 && !body.grounded; tick++) {
    sim.tickCount++;
    stepPets(sim);
    maximumZ = Math.max(maximumZ, body.z);
    if (body.zVel < 0) sawDescent = true;
  }
  return { sawDescent, maximumZ };
}
