import {
  LEVEL,
  TILE,
  WALL_DOOR_FEATURE_HEIGHT,
  World,
  featureApproachPosition,
  safeRoomFeatures,
  safeRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { GameSim } from "../../core/index.js";
import { content, findSafeRoomDoor, teleport } from "../support.js";

const bootSim = () => new GameSim({ world: new World(228182761, 1, LEVEL.Sandbox), content: content, store: new PlayerStore(null), rngSeed: 1234, opts: { testFixtures: true, freezeEnemies: true } }
);

describe("dynamic safe room doors", () => {
  it("shows one personal portal for a solo occupant plus the distinct exit", () => {
    const sim = bootSim();
    const player = sim.addPlayer({ name: "A", clientId: "solo-safe-room" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const entrance = findSafeRoomDoor(sim);
    teleport({ entity, ...featureApproachPosition(entrance), sim });
    sim.queueAction(player.playerId, { type: "interact" });
    const snapshot = sim.step().get(player.playerId)!;
    const features = safeRoomFeatures(entrance.doorCx, entrance.doorCy);

    expect(snapshot.roomDoors).toEqual([{
      ...features.doors[0],
      tile: TILE.DoorPersonal,
      featureHeight: WALL_DOOR_FEATURE_HEIGHT,
      ownerId: player.playerId,
      label: "A'S ROOM",
    }]);
    expect(sim.world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);
  });

  it("collapses same-party occupants into one shared party portal", () => {
    const sim = bootSim();
    const a = sim.addPlayer({ name: "A", clientId: "party-safe-a" });
    const b = sim.addPlayer({ name: "B", clientId: "party-safe-b" });
    const entrance = findSafeRoomDoor(sim);
    const spawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    teleport({ entity: sim.getPlayerEntity(a.playerId)!, x: spawn.x, y: spawn.y, sim: sim });
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: spawn.x + 1, y: spawn.y, sim: sim });
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    sim.step();
    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    const snapshot = sim.step().get(a.playerId)!;

    expect(snapshot.roomDoors).toHaveLength(1);
    expect(snapshot.roomDoors?.every((door) => door.tile === TILE.DoorParty)).toBe(true);
    expect(snapshot.roomDoors?.[0]?.label).toBe("PARTY ROOM");
  });

  it("gives each party member a private labeled personal door inside the party room", () => {
    const sim = bootSim();
    const a = sim.addPlayer({ name: "A", clientId: "party-private-a" });
    const b = sim.addPlayer({ name: "B", clientId: "party-private-b" });
    const entrance = findSafeRoomDoor(sim);
    const spawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    teleport({ entity: sim.getPlayerEntity(a.playerId)!, x: spawn.x, y: spawn.y, sim: sim });
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: spawn.x + 1, y: spawn.y, sim: sim });
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    sim.step();
    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    const safeSnapshot = sim.step().get(a.playerId)!;
    const partyDoor = safeSnapshot.roomDoors![0]!;
    teleport({
      entity: sim.getPlayerEntity(a.playerId)!,
      ...featureApproachPosition(partyDoor),
      sim,
    });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    teleport({
      entity: sim.getPlayerEntity(b.playerId)!,
      ...featureApproachPosition(partyDoor),
      sim,
    });
    sim.queueAction(b.playerId, { type: "interact" });
    const partySnapshot = sim.step().get(a.playerId)!;

    expect(partySnapshot.roomDoors).toHaveLength(2);
    expect(partySnapshot.roomDoors?.every((door) => door.tile === TILE.DoorPersonal)).toBe(true);
    expect(new Set(partySnapshot.roomDoors?.map((door) => door.label))).toEqual(
      new Set(["A'S ROOM", "B'S ROOM"]),
    );

    const aDoor = partySnapshot.roomDoors?.find((door) => door.ownerId === a.playerId);
    expect(aDoor).toBeDefined();
    if (!aDoor) throw new Error("missing A's personal-room door");
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport({ entity: bEntity, ...featureApproachPosition(aDoor), sim });
    sim.queueAction(b.playerId, { type: "interact" });
    const rejected = sim.step().get(b.playerId)!;
    expect(rejected.events).toContainEqual({ t: "toast", msg: "That personal room is private" });
    expect(bEntity.body.x).toBeCloseTo(aDoor.x + 0.5);
  });

  it("queues a visible food attendant greeting when a crawler enters", () => {
    const sim = bootSim();
    const player = sim.addPlayer({ name: "Ada", clientId: "safe-greeting" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const entrance = findSafeRoomDoor(sim);
    teleport({ entity, ...featureApproachPosition(entrance), sim });
    sim.queueAction(player.playerId, { type: "interact" });
    const snapshot = sim.step().get(player.playerId)!;
    const speech = snapshot.events.find((event) => event.t === "npcSpeech");

    expect(speech).toMatchObject({
      t: "npcSpeech",
      npcId: "safe-room-food-attendant",
      name: "Nib, Safe Room Attendant",
      durationMs: 4_000,
    });
    expect(speech && "text" in speech ? speech.text : "").toContain("Ada");
  });

  it("caps a shared safe room at twenty occupants", () => {
    const sim = bootSim();
    const entrance = findSafeRoomDoor(sim);
    const spawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    for (let index = 0; index < 20; index++) {
      const player = sim.addPlayer({ name: `P${index}`, clientId: `safe-cap-${index}` });
      teleport({ entity: sim.getPlayerEntity(player.playerId)!, x: spawn.x, y: spawn.y, sim: sim });
    }
    const blocked = sim.addPlayer({ name: "Blocked", clientId: "safe-cap-blocked" });
    const entity = sim.getPlayerEntity(blocked.playerId)!;
    teleport({ entity, ...featureApproachPosition(entrance), sim });
    sim.queueAction(blocked.playerId, { type: "interact" });
    const snapshot = sim.step().get(blocked.playerId)!;

    expect(entity.body.x).toBeCloseTo(entrance.x + 0.5);
    expect(snapshot.events).toContainEqual({ t: "toast", msg: "That safe room is full" });
  });
});
