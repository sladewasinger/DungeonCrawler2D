import {
  TILE,
  personalRoomSpawn,
  safeRoomSpawn,
  type Entity,
  type ServerSnapshot,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import {
  findSafeRoomDoor,
  makeParty,
  makeSim,
  teleport,
} from "./support.js";

function enterSharedSafeRoom(
  sim: GameSim,
  playerId: string,
  entrance: ReturnType<typeof findSafeRoomDoor>,
): void {
  const entity = sim.getPlayerEntity(playerId);
  if (!entity) throw new Error(`missing player ${playerId}`);
  teleport({ entity: entity, x: entrance.x + 0.5, y: entrance.y + 0.5, sim: sim });
  sim.queueAction(playerId, { type: "interact" });
  sim.step();
}

function playerEntity(sim: GameSim, playerId: string): Entity {
  const entity = sim.getPlayerEntity(playerId);
  if (!entity) throw new Error(`missing player ${playerId}`);
  return entity;
}

function playerSnapshot(
  snapshots: Map<string, ServerSnapshot>,
  playerId: string,
): ServerSnapshot {
  const snapshot = snapshots.get(playerId);
  if (!snapshot) throw new Error(`missing snapshot ${playerId}`);
  return snapshot;
}

function sees(snapshot: ServerSnapshot, entityId: string): boolean {
  return snapshot.entities.some((entry) => entry.id === entityId);
}

describe("personal room isolation", () => {
  it("routes distinct owners to separate rooms and private entity state", () => {
    const sim = makeSim();
    const a = sim.addPlayer({ name: "A", clientId: "private-owner-a" });
    const b = sim.addPlayer({ name: "B", clientId: "private-owner-b" });
    const entrance = findSafeRoomDoor(sim);
    enterSharedSafeRoom(sim, a.playerId, entrance);
    enterSharedSafeRoom(sim, b.playerId, entrance);

    const shared = sim.step();
    expect(sees(playerSnapshot(shared, a.playerId), b.playerId)).toBe(true);
    const doors = playerSnapshot(shared, a.playerId).roomDoors ?? [];
    const aDoor = doors.find((door) => door.ownerId === a.playerId);
    const bDoor = doors.find((door) => door.ownerId === b.playerId);
    if (!aDoor || !bDoor) throw new Error("missing personal-room assignments");
    expect(aDoor.tile).toBe(TILE.DoorPersonal);
    expect(bDoor.tile).toBe(TILE.DoorPersonal);

    teleport({ entity: playerEntity(sim, a.playerId), x: aDoor.x + 0.5, y: aDoor.y + 0.5, sim: sim });
    teleport({ entity: playerEntity(sim, b.playerId), x: bDoor.x + 0.5, y: bDoor.y + 0.5, sim: sim });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.queueAction(b.playerId, { type: "interact" });
    const privateSnapshots = sim.step();

    expect(playerEntity(sim, a.playerId).body).toMatchObject(personalRoomSpawn(0));
    expect(playerEntity(sim, b.playerId).body).toMatchObject(personalRoomSpawn(1));
    expect(sees(playerSnapshot(privateSnapshots, a.playerId), b.playerId)).toBe(false);
    expect(sees(playerSnapshot(privateSnapshots, b.playerId), a.playerId)).toBe(false);

    const aPosition = playerEntity(sim, a.playerId).body;
    const privateItem = sim.spawnItem({ defId: "rag", x: aPosition.x + 1, y: aPosition.y });
    const itemSnapshots = sim.step();
    expect(sees(playerSnapshot(itemSnapshots, a.playerId), privateItem.id)).toBe(true);
    expect(sees(playerSnapshot(itemSnapshots, b.playerId), privateItem.id)).toBe(false);
  });

  it("reclaims one authoritative entity for duplicate owner sessions", () => {
    const sim = makeSim();
    const first = sim.addPlayer({ name: "A", clientId: "same-private-owner" });
    const replacement = sim.addPlayer({ name: "A", clientId: "same-private-owner" });

    expect(replacement).toMatchObject({
      playerId: first.playerId,
      resumeToken: first.resumeToken,
      resumed: true,
    });
    expect(sim.playerCount).toBe(1);
  });

  it("keeps safe hubs and party destinations shared", () => {
    const sim = makeSim();
    const { aId, bId } = makeParty(sim);
    const entrance = findSafeRoomDoor(sim);
    const safeSpawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    teleport({ entity: playerEntity(sim, aId), x: safeSpawn.x, y: safeSpawn.y, sim: sim });
    teleport({ entity: playerEntity(sim, bId), x: safeSpawn.x + 1, y: safeSpawn.y, sim: sim });
    const sharedSafe = sim.step();

    expect(sees(playerSnapshot(sharedSafe, aId), bId)).toBe(true);
    const partyDoor = playerSnapshot(sharedSafe, aId).roomDoors?.find(
      (door) => door.tile === TILE.DoorParty,
    );
    if (!partyDoor) throw new Error("missing shared party-room assignment");
    for (const playerId of [aId, bId]) {
      teleport({ entity: playerEntity(sim, playerId), x: partyDoor.x + 0.5, y: partyDoor.y + 0.5, sim: sim });
      sim.queueAction(playerId, { type: "interact" });
    }
    const sharedParty = sim.step();
    expect(sees(playerSnapshot(sharedParty, aId), bId)).toBe(true);
  });
});
