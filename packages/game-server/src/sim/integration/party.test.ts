import {
  PLAYER_MAX_HP,
  REVIVE_HOLD_TICKS,
  RESPAWN_DELAY_TICKS,
  TILE,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomFeatures,
  safeRoomSpawn,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { snapToFloor, snapToFloorTile } from "../testzone.js";
import { eventsOf, findSafeRoomDoor, makeParty, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 7 regressions driven through the full GameSim facade (wire-level
 * action dispatch, not just sim/social.ts's unit tests): party
 * proximity/consent, AOI-scoped chat, downed/revive, give-up, and the
 * nested portal/crafting/stash flow — ported from
 * reference/game-server/sim.test.ts.
 */

describe("GameSim: party, portals, crafting, stash", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("party invite/accept requires proximity and consent; leave disbands at 1", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + 500, y: a.spawn.y, sim: sim });
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    let snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(false);

    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + 2, y: a.spawn.y, sim: sim });
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(true);

    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party?.members.map((m) => m.id)).toContain(b.playerId);

    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + 500, y: a.spawn.y, sim: sim });
    snaps = sim.step();
    const ping = snaps.get(a.playerId)!.party!.members.find((m) => m.id === b.playerId)!;
    expect(ping.x).toBeCloseTo(a.spawn.x + 500, 3);

    sim.queueAction(b.playerId, { type: "party", op: "leave" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party).toBeNull();
  });

  it("party chat reaches members anywhere; local chat is AOI-scoped", () => {
    const { aId, bId } = makeParty(sim);
    teleport({ entity: sim.getPlayerEntity(bId)!, x: sim.getPlayerEntity(aId)!.body.x + 500, y: sim.getPlayerEntity(aId)!.body.y, sim: sim });
    sim.queueAction(aId, { type: "chat", channel: "party", text: "descend at dawn" });
    let snaps = sim.step();
    expect(eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "descend at dawn")).toBe(true);

    sim.queueAction(aId, { type: "chat", channel: "local", text: "anyone here?" });
    snaps = sim.step();
    expect(eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "anyone here?")).toBe(false);
  });

  it("a downed player can be revived by a nearby party member", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    bEntity.hp = 0;
    let snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBe(true);
    expect(snaps.get(bId)!.self.hp).toBe(1);

    sim.queueAction(aId, { type: "revive", targetId: bId, held: true });
    sim.step();
    snaps = stepN(sim, REVIVE_HOLD_TICKS);
    expect(snaps.get(bId)!.self.downed).toBeUndefined();
    expect(snaps.get(bId)!.self.hp).toBe(Math.round(PLAYER_MAX_HP * 0.3));
  });

  it("a downed player can give up and then waits through the dead screen", () => {
    const { bId } = makeParty(sim);
    const player = sim.getPlayerEntity(bId)!;
    player.hp = 0;
    let snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBe(true);

    sim.queueAction(bId, { type: "suicide" });
    snaps = sim.step();
    expect(snaps.get(bId)!.self.hp).toBe(0);
    expect(snaps.get(bId)!.self.downed).toBeUndefined();

    stepN(sim, RESPAWN_DELAY_TICKS);
    expect(sim.getPlayerEntity(bId)!.hp).toBe(PLAYER_MAX_HP);
  });

  it("portals nest: world door -> safe room -> personal room -> exits unwind", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const door = findSafeRoomDoor(sim);
    expect(sim.world.tileAt(door.x, door.y)).toBe(TILE.DoorSafeRoom);
    expect(sim.world.isSanctuary(door.x, door.y + 1)).toBe(false);
    teleport({ entity: entity, x: door.x + 0.5, y: door.y + 0.5, sim: sim });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();

    const safe = safeRoomSpawn(door.doorCx, door.doorCy);
    expect(entity.body.x).toBeCloseTo(safe.x, 3);
    expect(entity.body.y).toBeCloseTo(safe.y, 3);
    expect(sim.world.isSanctuary(Math.floor(safe.x), Math.floor(safe.y))).toBe(true);
    const safeF = safeRoomFeatures(door.doorCx, door.doorCy);
    const personalDoor = safeF.doors[0]!;
    expect(sim.world.tileAt(safeF.exit.x, safeF.exit.y)).toBe(TILE.DoorExit);

    teleport({ entity: entity, x: personalDoor.x + 0.5, y: personalDoor.y + 0.5, sim: sim });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    const spawn = personalRoomSpawn(0); // first client gets slot 0
    expect(entity.body.x).toBeCloseTo(spawn.x, 3);
    const features = personalRoomFeatures(0);
    expect(sim.world.isSanctuary(Math.floor(entity.body.x), Math.floor(entity.body.y))).toBe(true);

    teleport({ entity: entity, x: features.exit.x + 0.5, y: features.exit.y + 0.5, sim: sim });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(personalDoor.x + 0.5, 3);

    teleport({ entity: entity, x: safeF.exit.x + 0.5, y: safeF.exit.y + 0.5, sim: sim });
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(door.x + 0.5, 3);
    expect(entity.body.y).toBeCloseTo(door.y + 0.5, 3);
  });

  it("the proving ground offers every epic's examples: weapons, hazards, enemies", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const snap = stepN(sim, 2).get(a.playerId)!;

    const itemDefs = new Set(snap.entities.filter((e) => e.kind === "item").map((e) => e.defId));
    for (const def of ["sword", "hammer", "bandage", "rag", "vodka-bottle"]) {
      expect(itemDefs, `missing ground item ${def}`).toContain(def);
    }

    const fireSpot = snapToFloorTile({ sim, x: 34, y: 24 });
    const poisonSpot = snapToFloorTile({ sim, x: 18, y: 33 });
    expect(sim.areas.defAt(fireSpot.x, fireSpot.y)).toBe("area-fire");
    expect(sim.areas.defAt(poisonSpot.x, poisonSpot.y)).toBe("area-poison");
    expect(sim.enemyCount).toBeGreaterThanOrEqual(5);
  });

  it("a picked-up sword out-damages fists", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    sim.endSpawnGrace(b.playerId); // hand-placed victim, not a fresh spawn (spawnSafety.ts)
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;

    const swordSpot = snapToFloor({ sim, x: 30.5, y: 27.5 }); // testzone.ts's canonical sword fixture
    teleport({ entity: aEntity, x: swordSpot.x, y: swordSpot.y, sim: sim });
    sim.step();
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    expect(sim.getInventory(a.playerId)![0]?.item).toBe("sword");

    teleport({ entity: bEntity, x: aEntity.body.x + 1, y: aEntity.body.y, sim: sim });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(PLAYER_MAX_HP - bEntity.hp).toBeGreaterThanOrEqual(8); // sword, not fists
  });

});
