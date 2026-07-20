import {
  LEVEL,
  PLAYER_MAX_HP,
  TILE,
  World,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomFeatures,
  safeRoomSpawn,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { PlayerStore } from "../../store.js";
import { snapToFloor, snapToFloorTile } from "../testzone.js";
import { content, SEED, eventsOf, findSafeRoomDoor, makeParty, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 7 regressions driven through the full GameSim facade (wire-level
 * action dispatch, not just sim/social.ts's unit tests): party
 * proximity/consent, AOI-scoped chat, downed/revive, suicide, and the
 * nested portal/crafting/stash flow — ported from
 * reference/game-server/sim.test.ts.
 */

describe("GameSim: party, portals, crafting, stash", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("party invite/accept requires proximity and consent; leave disbands at 1", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + 500, a.spawn.y, sim);
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    let snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(false);

    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + 2, a.spawn.y, sim);
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(true);

    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party?.members.map((m) => m.id)).toContain(b.playerId);

    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + 500, a.spawn.y, sim);
    snaps = sim.step();
    const ping = snaps.get(a.playerId)!.party!.members.find((m) => m.id === b.playerId)!;
    expect(ping.x).toBeCloseTo(a.spawn.x + 500, 3);

    sim.queueAction(b.playerId, { type: "party", op: "leave" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party).toBeNull();
  });

  it("party chat reaches members anywhere; local chat is AOI-scoped", () => {
    const { aId, bId } = makeParty(sim);
    teleport(sim.getPlayerEntity(bId)!, sim.getPlayerEntity(aId)!.body.x + 500, sim.getPlayerEntity(aId)!.body.y, sim);
    sim.queueAction(aId, { type: "chat", channel: "party", text: "descend at dawn" });
    let snaps = sim.step();
    expect(eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "descend at dawn")).toBe(true);

    sim.queueAction(aId, { type: "chat", channel: "local", text: "anyone here?" });
    snaps = sim.step();
    expect(eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "anyone here?")).toBe(false);
  });

  it("downed party members bleed out unless revived", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    bEntity.hp = 0;
    let snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBe(true);
    expect(snaps.get(bId)!.self.hp).toBe(1);

    sim.queueAction(aId, { type: "interact" });
    snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBeUndefined();
    expect(snaps.get(bId)!.self.hp).toBe(Math.round(PLAYER_MAX_HP * 0.3));
  });

  it("menu suicide bypasses downed state and dead players cannot act", () => {
    const { aId } = makeParty(sim);
    const player = sim.getPlayerEntity(aId)!;
    const enemy = sim.spawnEnemy("slime", player.body.x + 1, player.body.y);
    const enemyHp = enemy.hp;

    sim.queueAction(aId, { type: "suicide" });
    let snaps = sim.step();
    expect(snaps.get(aId)!.self.hp).toBe(0);
    expect(snaps.get(aId)!.self.downed).toBeUndefined();

    const x = player.body.x;
    const y = player.body.y;
    sim.handleInput(aId, { type: "input", seq: 100, moveX: 1, moveY: 0, jump: true, run: false });
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    snaps = sim.step();
    expect(player.body.x).toBe(x);
    expect(player.body.y).toBe(y);
    expect(enemy.hp).toBe(enemyHp);
    expect(snaps.get(aId)!.self.hp).toBe(0);
  });

  it("portals nest: world door -> safe room -> personal room -> exits unwind", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const door = findSafeRoomDoor(sim);
    expect(sim.world.tileAt(door.x, door.y)).toBe(TILE.DoorSafeRoom);
    expect(sim.world.isSanctuary(door.x, door.y + 1)).toBe(false);
    teleport(entity, door.x + 0.5, door.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();

    const safe = safeRoomSpawn(door.doorCx, door.doorCy);
    expect(entity.body.x).toBeCloseTo(safe.x, 3);
    expect(entity.body.y).toBeCloseTo(safe.y, 3);
    expect(sim.world.isSanctuary(Math.floor(safe.x), Math.floor(safe.y))).toBe(true);
    const safeF = safeRoomFeatures(door.doorCx, door.doorCy);
    expect(sim.world.tileAt(safeF.doorPersonal.x, safeF.doorPersonal.y)).toBe(TILE.DoorPersonal);
    expect(sim.world.tileAt(safeF.exit.x, safeF.exit.y)).toBe(TILE.DoorExit);
    expect(sim.world.tileAt(safeF.stash.x, safeF.stash.y)).toBe(TILE.Stash);

    teleport(entity, safeF.doorPersonal.x + 0.5, safeF.doorPersonal.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    const spawn = personalRoomSpawn(0); // first client gets slot 0
    expect(entity.body.x).toBeCloseTo(spawn.x, 3);
    const features = personalRoomFeatures(0);
    expect(sim.world.isSanctuary(Math.floor(entity.body.x), Math.floor(entity.body.y))).toBe(true);

    teleport(entity, features.exit.x + 0.5, features.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(safeF.doorPersonal.x + 0.5, 3);

    teleport(entity, safeF.exit.x + 0.5, safeF.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(door.x + 0.5, 3);
    expect(entity.body.y).toBeCloseTo(door.y + 0.5, 3);
  });

  it("the proving ground offers every epic's examples: weapons, hazards, enemies", () => {
    const a = sim.addPlayer("A", "client-a");
    const snap = stepN(sim, 2).get(a.playerId)!;

    const itemDefs = new Set(snap.entities.filter((e) => e.kind === "item").map((e) => e.defId));
    for (const def of ["sword", "hammer", "bandage", "rag", "vodka-bottle"]) {
      expect(itemDefs, `missing ground item ${def}`).toContain(def);
    }

    const fireSpot = snapToFloorTile(sim, 34, 24);
    const poisonSpot = snapToFloorTile(sim, 18, 33);
    expect(sim.areas.defAt(fireSpot.x, fireSpot.y)).toBe("area-fire");
    expect(sim.areas.defAt(poisonSpot.x, poisonSpot.y)).toBe("area-poison");
    expect(sim.enemyCount).toBeGreaterThanOrEqual(5);
  });

  it("a picked-up sword out-damages fists", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;

    const swordSpot = snapToFloor(sim, 30.5, 27.5); // testzone.ts's canonical sword fixture
    teleport(aEntity, swordSpot.x, swordSpot.y, sim);
    sim.step();
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    expect(sim.getInventory(a.playerId)![0]?.item).toBe("sword");

    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(PLAYER_MAX_HP - bEntity.hp).toBeGreaterThanOrEqual(8); // sword, not fists
  });

  it("crafting needs the table and the ingredients", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const inv = sim.getInventory(a.playerId)!;
    inv[0] = { item: "rag", qty: 2 };

    sim.queueAction(a.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inv.some((s) => s?.item === "bandage")).toBe(false);

    const features = personalRoomFeatures(0);
    teleport(entity, features.table.x - 0.5, features.table.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inv.some((s) => s?.item === "bandage")).toBe(true);
    expect(inv.some((s) => s?.item === "rag")).toBe(false);
  });

  it("stash persists across sims (server restarts) via the store", () => {
    const store = new PlayerStore(null);
    const sim1 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 1234, { testFixtures: true });
    const a = sim1.addPlayer("A", "client-a");
    const entity = sim1.getPlayerEntity(a.playerId)!;
    const features = personalRoomFeatures(0);
    teleport(entity, features.stash.x + 1.5, features.stash.y + 0.5, sim1);
    sim1.getInventory(a.playerId)![0] = { item: "knife", qty: 1 };
    sim1.queueAction(a.playerId, { type: "stash", op: "put", index: 0 });
    const snaps = sim1.step();
    const stashEvent = eventsOf(snaps, a.playerId).find((e) => e.t === "stash");
    expect(stashEvent && stashEvent.t === "stash" ? stashEvent.slots : []).toEqual([{ item: "knife", qty: 1 }]);

    const sim2 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 99, { testFixtures: true });
    const again = sim2.addPlayer("A", "client-a");
    // The restart lost the in-memory weapon/inventory (only the stash
    // persisted), so this returning join is kit-less and ensureStarterKit
    // re-grants (ASSUMPTION #87, supersedes #2) — the sword/torch stacks
    // land before the stashed knife, which the "take" below appends.
    expect(sim2.getInventory(again.playerId)?.find((s) => s.item === "sword")?.qty).toBe(1);
    const entity2 = sim2.getPlayerEntity(again.playerId)!;
    teleport(entity2, features.stash.x + 1.5, features.stash.y + 0.5, sim2);
    sim2.queueAction(again.playerId, { type: "stash", op: "take", index: 0 });
    sim2.step();
    expect(sim2.getInventory(again.playerId)?.find((s) => s.item === "knife")).toEqual({ item: "knife", qty: 1 });
  });
});
