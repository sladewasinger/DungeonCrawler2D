import { LEVEL, TILE, World, safeRoomFeatures, safeRoomSpawn } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { GameSim } from "../index.js";
import { content, findSafeRoomDoor, teleport } from "./support.js";

const bootSim = () => new GameSim(
  new World(228182761, 1, LEVEL.Sandbox),
  content,
  new PlayerStore(null),
  1234,
  { testFixtures: true, freezeEnemies: true },
);

describe("dynamic safe room doors", () => {
  it("shows one personal portal for a solo occupant plus the distinct exit", () => {
    const sim = bootSim();
    const player = sim.addPlayer("A", "solo-safe-room");
    const entity = sim.getPlayerEntity(player.playerId)!;
    const entrance = findSafeRoomDoor(sim);
    teleport(entity, entrance.x + 0.5, entrance.y + 0.5, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    const snapshot = sim.step().get(player.playerId)!;
    const features = safeRoomFeatures(entrance.doorCx, entrance.doorCy);

    expect(snapshot.roomDoors).toEqual([{
      ...features.doors[0],
      tile: TILE.DoorPersonal,
      ownerId: player.playerId,
      label: "A'S ROOM",
    }]);
    expect(sim.world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);
  });

  it("collapses same-party occupants into one shared party portal", () => {
    const sim = bootSim();
    const a = sim.addPlayer("A", "party-safe-a");
    const b = sim.addPlayer("B", "party-safe-b");
    const entrance = findSafeRoomDoor(sim);
    const spawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    teleport(sim.getPlayerEntity(a.playerId)!, spawn.x, spawn.y, sim);
    teleport(sim.getPlayerEntity(b.playerId)!, spawn.x + 1, spawn.y, sim);
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
    const a = sim.addPlayer("A", "party-private-a");
    const b = sim.addPlayer("B", "party-private-b");
    const entrance = findSafeRoomDoor(sim);
    const spawn = safeRoomSpawn(entrance.doorCx, entrance.doorCy);
    teleport(sim.getPlayerEntity(a.playerId)!, spawn.x, spawn.y, sim);
    teleport(sim.getPlayerEntity(b.playerId)!, spawn.x + 1, spawn.y, sim);
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    sim.step();
    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    const safeSnapshot = sim.step().get(a.playerId)!;
    const partyDoor = safeSnapshot.roomDoors![0]!;
    teleport(sim.getPlayerEntity(a.playerId)!, partyDoor.x + 0.5, partyDoor.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    teleport(sim.getPlayerEntity(b.playerId)!, partyDoor.x + 0.5, partyDoor.y + 0.5, sim);
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
    teleport(bEntity, aDoor.x + 0.5, aDoor.y + 0.5, sim);
    sim.queueAction(b.playerId, { type: "interact" });
    const rejected = sim.step().get(b.playerId)!;
    expect(rejected.events).toContainEqual({ t: "toast", msg: "That personal room is private" });
    expect(bEntity.body.x).toBeCloseTo(aDoor.x + 0.5);
  });

  it("queues a visible food attendant greeting when a crawler enters", () => {
    const sim = bootSim();
    const player = sim.addPlayer("Ada", "safe-greeting");
    const entity = sim.getPlayerEntity(player.playerId)!;
    const entrance = findSafeRoomDoor(sim);
    teleport(entity, entrance.x + 0.5, entrance.y + 0.5, sim);
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
      const player = sim.addPlayer(`P${index}`, `safe-cap-${index}`);
      teleport(sim.getPlayerEntity(player.playerId)!, spawn.x, spawn.y, sim);
    }
    const blocked = sim.addPlayer("Blocked", "safe-cap-blocked");
    const entity = sim.getPlayerEntity(blocked.playerId)!;
    teleport(entity, entrance.x + 0.5, entrance.y + 0.5, sim);
    sim.queueAction(blocked.playerId, { type: "interact" });
    const snapshot = sim.step().get(blocked.playerId)!;

    expect(entity.body.x).toBeCloseTo(entrance.x + 0.5);
    expect(snapshot.events).toContainEqual({ t: "toast", msg: "That safe room is full" });
  });
});
