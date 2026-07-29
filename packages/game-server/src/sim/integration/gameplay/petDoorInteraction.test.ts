import {
  LEVEL,
  World,
  featureApproachPosition,
  safeRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { GameSim } from "../../core/index.js";
import { PET_DEFINITIONS } from "../../pets/index.js";
import { content, findSafeRoomDoor, teleport } from "../support.js";

describe("pet interaction routing", () => {
  it("lets a pet owner ignore their companion and enter a safe-room door", () => {
    const sim = new GameSim({
      world: new World(228182761, 1, LEVEL.Dungeon),
      content,
      store: new PlayerStore(null),
      rngSeed: 1234,
      opts: { freezeEnemies: true },
    });
    const player = sim.addPlayer({ name: "A", clientId: "pet-door-owner" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const pet = sim.spawnPet(PET_DEFINITIONS[0]!, player.spawn.x + 1, player.spawn.y);

    teleport({ entity, x: pet.body.x, y: pet.body.y, sim });
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();
    sim.queueAction(player.playerId, { type: "interact" });
    const ownPetInteraction = sim.step().get(player.playerId)!;
    expect(ownPetInteraction.events).not.toContainEqual({
      t: "toast",
      msg: "You already have a pet.",
    });

    const door = findSafeRoomDoor(sim);
    teleport({ entity, ...featureApproachPosition(door), sim });
    sim.queueAction(player.playerId, { type: "interact" });
    const entered = sim.step().get(player.playerId)!;
    const safeRoom = safeRoomSpawn(door.doorCx, door.doorCy);

    expect(entity.body.x).toBeCloseTo(safeRoom.x, 3);
    expect(entity.body.y).toBeCloseTo(safeRoom.y, 3);
    expect(entered.events).not.toContainEqual({
      t: "toast",
      msg: "You already have a pet.",
    });
  });
});
