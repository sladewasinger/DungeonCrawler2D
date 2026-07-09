import { content } from "@dc2d/content";
import {
  AOI_RADIUS,
  ATTACK_COOLDOWN_MS,
  MIN_SPAWN_DIST,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_MS,
  RESPAWN_DELAY_TICKS,
  TEST_SPAWN,
  TICK_RATE,
  TILE,
  World,
  hashString,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomFeatures,
  safeRoomSpawn,
  type ClientInput,
  type Entity,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "./sim";
import { PlayerStore } from "./store";

/**
 * Headless multi-client integration tests: this drives the exact sim
 * the ws server runs in production, minus the sockets. Epics 2–7.
 */

const SEED = hashString("sim-test-world");
/** Ticks until the next melee swing is accepted (see actions.ts). */
const SWING_TICKS = Math.round((ATTACK_COOLDOWN_MS / 1000) * TICK_RATE);

function input(seq: number, moveX: -1 | 0 | 1, moveY: -1 | 0 | 1, jump = false): ClientInput {
  return { type: "input", seq, moveX, moveY, jump };
}

function teleport(entity: Entity, x: number, y: number, sim: GameSim): void {
  entity.body.x = x;
  entity.body.y = y;
  entity.body.z = sim.world.heightAt(Math.floor(x), Math.floor(y));
  entity.body.grounded = true;
  entity.body.fallPeak = entity.body.z;
}

function stepN(sim: GameSim, n: number): Map<string, ServerSnapshot> {
  let out = new Map<string, ServerSnapshot>();
  for (let i = 0; i < n; i++) out = sim.step();
  return out;
}

function eventsOf(snapshots: Map<string, ServerSnapshot>, id: string): GameEvent[] {
  return snapshots.get(id)?.events ?? [];
}

describe("GameSim", () => {
  let sim: GameSim;
  let store: PlayerStore;

  beforeEach(() => {
    store = new PlayerStore(null);
    sim = new GameSim(new World(SEED, 1), content, store, 1234);
  });

  // ── dev harness: debug commands ──────────────────────────────────

  it("debug teleport and god mode work when enabled — and are dropped when not", () => {
    // Default sim: debugCommands off — debug intents are ignored.
    const a = sim.addPlayer("A", "client-a");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const spawnX = aEntity.body.x;
    sim.queueAction(a.playerId, { type: "debug", op: "teleport", x: 500.5, y: 500.5 });
    sim.step();
    expect(aEntity.body.x).toBeCloseTo(spawnX, 3);

    // Dev sim: teleport moves the player; god mode shrugs off a skeleton.
    const dev = new GameSim(new World(SEED, 1), content, new PlayerStore(null), 99, {
      debugCommands: true,
    });
    const b = dev.addPlayer("B", "client-b");
    const bEntity = dev.getPlayerEntity(b.playerId)!;
    dev.queueAction(b.playerId, { type: "debug", op: "teleport", x: 10.5, y: 30.5 });
    dev.step();
    expect(bEntity.body.x).toBeCloseTo(10.5, 3);
    expect(bEntity.body.y).toBeCloseTo(30.5, 3);

    dev.queueAction(b.playerId, { type: "debug", op: "god", on: true });
    dev.step();
    dev.spawnEnemy("skeleton", bEntity.body.x + 1, bEntity.body.y);
    for (let i = 0; i < TICK_RATE * 4; i++) dev.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP); // it swung plenty; god shrugged
    expect(bEntity.body.kx).toBe(0); // and no knockback sticks
  });

  // ── Epic 2 regression: spawn / AOI / reconnect ───────────────────

  it("spawns the first player at the proving ground, others far away", () => {
    const a = sim.addPlayer("A", "client-a");
    expect(a.spawn.x).toBeCloseTo(TEST_SPAWN.x, 5);
    const b = sim.addPlayer("B", "client-b");
    expect(Math.hypot(a.spawn.x - b.spawn.x, a.spawn.y - b.spawn.y)).toBeGreaterThanOrEqual(
      MIN_SPAWN_DIST,
    );
  });

  it("replicates only within AOI, with enter/leave notices", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    let snap = sim.step().get(a.playerId)!;
    expect(snap.entities.filter((e) => e.kind === "player")).toHaveLength(0);

    teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x + 3, TEST_SPAWN.y, sim);
    snap = sim.step().get(a.playerId)!;
    expect(snap.entities.some((e) => e.id === b.playerId)).toBe(true);

    teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x + AOI_RADIUS * 3, TEST_SPAWN.y, sim);
    snap = sim.step().get(a.playerId)!;
    expect(snap.left).toContain(b.playerId);
  });

  it("resumes with a fresh input sequence and full area sync", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.handleInput(a.playerId, input(500, 1, 0));
    sim.step();
    sim.markDisconnected(a.playerId);
    sim.step();
    const resumed = sim.addPlayer("A", "client-a", a.resumeToken);
    expect(resumed.resumed).toBe(true);
    sim.handleInput(a.playerId, input(1, 1, 0));
    const snap = sim.step().get(a.playerId)!;
    expect(snap.lastSeq).toBe(1);
  });

  it("a resume token is useless with a different clientId (no identity theft)", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.markDisconnected(a.playerId);
    const thief = sim.addPlayer("A", "client-evil", a.resumeToken);
    expect(thief.resumed).toBe(false);
    expect(thief.playerId).not.toBe(a.playerId);
  });

  it("reaps disconnected players after the grace window, dropping their loot", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.getInventory(a.playerId)![0] = { item: "knife", qty: 1 };
    sim.markDisconnected(a.playerId);
    stepN(sim, Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE) + 2);
    expect(sim.playerCount).toBe(0);
    // Their inventory hit the floor — lootable, per full-loot rules.
    const b = sim.addPlayer("B", "client-b");
    teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x, TEST_SPAWN.y, sim);
    const snap = sim.step().get(b.playerId)!;
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "knife")).toBe(true);
  });

  // ── Epic 3: effects in the sim ───────────────────────────────────

  it("standing in fire ignites you; fire cannot exist in sanctuary", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    sim.areas.spawn("area-fire", Math.floor(entity.body.x), Math.floor(entity.body.y), 0);
    const snap = sim.step().get(a.playerId)!;
    expect(snap.self.fx).toContain("on-fire");

    // Sanctuary: inside the instanced safe room behind the test-zone door.
    const safe = safeRoomSpawn(1, 1);
    teleport(entity, safe.x, safe.y, sim);
    sim.areas.spawn("area-fire", Math.floor(safe.x), Math.floor(safe.y), 1);
    expect(sim.areas.defAt(Math.floor(safe.x), Math.floor(safe.y))).toBeNull();
  });

  it("falls hurt; feather-fall negates", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    entity.maxHp = 100;
    entity.hp = 100;

    const dropFrom = (height: number) => {
      teleport(entity, 30.5, 30.5, sim); // flat h0, far from zone borders
      entity.body.z = height;
      entity.body.grounded = false;
      entity.body.zVel = 0;
      entity.body.fallPeak = height;
      stepN(sim, 30); // ~1.5 s of gravity
      expect(entity.body.grounded).toBe(true);
      expect(entity.body.z).toBe(0);
    };

    dropFrom(8);
    // (8 - SAFE_FALL 3) × 6 dmg/unit = 30.
    expect(entity.hp).toBe(70);

    dropFrom(2); // under the safe-fall threshold: free
    expect(entity.hp).toBe(70);

    sim.effects.applyStatus(entity, "feather-fall", []);
    dropFrom(8);
    expect(entity.hp).toBe(70);
  });

  // ── Epic 4: items, inventory, throwables ─────────────────────────

  it("picks up, stacks, drops, and consumes items", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    sim.spawnItem("rag", entity.body.x + 0.5, entity.body.y, 2);
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    const inv = sim.getInventory(a.playerId)!;
    expect(inv[0]).toEqual({ item: "rag", qty: 2 });

    sim.spawnItem("rag", entity.body.x + 0.5, entity.body.y, 3);
    sim.queueAction(a.playerId, { type: "pickup" });
    sim.step();
    expect(inv[0]).toEqual({ item: "rag", qty: 5 }); // stacked

    sim.queueAction(a.playerId, { type: "drop", slot: 0 });
    let snap = sim.step().get(a.playerId)!;
    expect(inv[0]).toBeNull();
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "rag")).toBe(true);

    // Consume: bandage heals and strips bleeding.
    entity.hp = 20;
    sim.effects.applyStatus(entity, "bleeding", []);
    inv[1] = { item: "bandage", qty: 1 };
    sim.queueAction(a.playerId, { type: "useSlot", slot: 1 });
    snap = sim.step().get(a.playerId)!;
    expect(snap.self.hp).toBe(24);
    expect(snap.self.fx).not.toContain("bleeding");
    expect(inv[1]).toBeNull();
  });

  it("a thrown vodka bottle leaves an oil slick; a torch onto it ignites", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const inv = sim.getInventory(a.playerId)!;
    inv[0] = { item: "vodka-bottle", qty: 1 };
    const tx = entity.body.x + 4;
    const ty = entity.body.y;
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30); // flight + impact
    const oilTile = nearbyAreaTile(sim, tx, ty, "oil");
    expect(oilTile).not.toBeNull();

    inv[0] = { item: "torch", qty: 1 };
    sim.queueAction(a.playerId, { type: "useSlot", slot: 0, targetX: tx, targetY: ty });
    stepN(sim, 30);
    expect(nearbyAreaTile(sim, tx, ty, "fire")).not.toBeNull();
  });

  // ── Epic 6: combat ───────────────────────────────────────────────

  it("melee swings gate on a cooldown — spam clicks land exactly one hit", () => {
    const a = sim.addPlayer("A", "client-a");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1, aEntity.body.y);
    // A burst of attack intents in one tick and the next: one swing.
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    teleport(slime, aEntity.body.x + 1, aEntity.body.y, sim); // undo knockback
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3);

    // After the cooldown, the next swing lands.
    stepN(sim, SWING_TICKS);
    teleport(slime, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 6);
  });

  it("melee prefers the enemy over an adjacent party member (targeting aid)", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    // Friend closer than the slime, both in the swing arc; the slime
    // sits just outside its own bite range so it can't muddy the test.
    teleport(bEntity, aEntity.body.x + 0.5, aEntity.body.y, sim);
    const slime = sim.spawnEnemy("slime", aEntity.body.x + 1.5, aEntity.body.y);
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(slime.hp).toBe(12 - 3); // fists
    expect(bEntity.hp).toBe(PLAYER_MAX_HP); // friend untouched

    // No hostile in arc → the friend takes the hit. Trust, not immunity.
    slime.hp = 0;
    sim.step(); // reap the corpse
    stepN(sim, SWING_TICKS); // let the swing cooldown recover
    teleport(bEntity, aEntity.body.x + 0.5, aEntity.body.y, sim);
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP - 3);
  });

  it("weapons carry damage, statuses, and source tags (knife bleeds a player)", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    sim.getInventory(a.playerId)![0] = { item: "knife", qty: 1 };
    // Swing until the 40% bleed chance lands (seeded rng, bounded),
    // waiting out the swing cooldown between attempts.
    for (let i = 0; i < 10 && !bEntity.statuses.some((s) => s.defId === "bleeding"); i++) {
      sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
      sim.step();
      teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim); // undo knockback
      stepN(sim, SWING_TICKS);
      teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    }
    expect(bEntity.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(bEntity.statuses.some((s) => s.defId === "bleeding")).toBe(true);
  });

  it("sanctuary suppresses PvP entirely", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;
    const safe = safeRoomSpawn(1, 1); // room behind the test-zone door
    teleport(aEntity, safe.x, safe.y, sim);
    teleport(bEntity, safe.x + 1, safe.y, sim);
    sim.queueAction(a.playerId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP);
  });

  it("enemies chase and hurt players; kills drop loot and respawn far away", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    teleport(entity, 10.5, 30.5, sim); // flat ground, away from fixtures
    sim.spawnEnemy("skeleton", 13.5, 30.5);
    stepN(sim, TICK_RATE * 4); // it closes in and swings
    expect(entity.hp).toBeLessThan(PLAYER_MAX_HP);

    // Force the kill: full loot drop where they fell, then respawn.
    sim.getInventory(a.playerId)![0] = { item: "torch", qty: 2 };
    const deathX = entity.body.x;
    entity.hp = 0;
    sim.step();
    const respawnSnaps = stepN(sim, RESPAWN_DELAY_TICKS + 2);
    const snap = respawnSnaps.get(a.playerId)!;
    expect(snap.self.hp).toBe(PLAYER_MAX_HP);
    expect(sim.getInventory(a.playerId)![0]).toBeNull();
    expect(Math.abs(snap.self.x - deathX)).toBeGreaterThan(1); // moved elsewhere
  });

  it("dead enemies roll their drop table", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    // plant-creeper drops stick @90% — kill a few to see one.
    for (let i = 0; i < 3; i++) {
      const plant = sim.spawnEnemy("plant-creeper", entity.body.x + 2 + i, entity.body.y);
      plant.hp = 0;
    }
    const snap = sim.step().get(a.playerId)!;
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "stick")).toBe(true);
  });

  // ── Epic 7: parties, rooms, crafting, stash ──────────────────────

  it("party invite/accept requires proximity and consent; leave disbands at 1", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    // Too far: invite is dropped.
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    let snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(false);

    teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x + 2, TEST_SPAWN.y, sim);
    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    snaps = sim.step();
    expect(eventsOf(snaps, b.playerId).some((e) => e.t === "invite")).toBe(true);

    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party?.members.map((m) => m.id)).toContain(b.playerId);

    // Party members see each other's pings even far outside AOI.
    teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x + 500, TEST_SPAWN.y, sim);
    snaps = sim.step();
    const ping = snaps.get(a.playerId)!.party!.members.find((m) => m.id === b.playerId)!;
    expect(ping.x).toBeCloseTo(TEST_SPAWN.x + 500, 3);

    sim.queueAction(b.playerId, { type: "party", op: "leave" });
    snaps = sim.step();
    expect(snaps.get(a.playerId)!.party).toBeNull(); // disbanded at 1 member
  });

  it("party chat reaches members anywhere; local chat is AOI-scoped", () => {
    const { aId, bId } = makeParty(sim);
    teleport(sim.getPlayerEntity(bId)!, TEST_SPAWN.x + 500, TEST_SPAWN.y, sim);
    sim.queueAction(aId, { type: "chat", channel: "party", text: "descend at dawn" });
    let snaps = sim.step();
    expect(
      eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "descend at dawn"),
    ).toBe(true);

    sim.queueAction(aId, { type: "chat", channel: "local", text: "anyone here?" });
    snaps = sim.step();
    expect(eventsOf(snaps, bId).some((e) => e.t === "chat" && e.text === "anyone here?")).toBe(
      false,
    ); // 500 tiles away
  });

  it("downed party members bleed out unless revived", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);
    bEntity.hp = 0;
    let snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBe(true);
    expect(snaps.get(bId)!.self.hp).toBe(1); // clinging on

    sim.queueAction(aId, { type: "interact" });
    snaps = sim.step();
    expect(snaps.get(bId)!.self.downed).toBeUndefined();
    expect(snaps.get(bId)!.self.hp).toBe(Math.round(PLAYER_MAX_HP * 0.3));
  });

  it("portals nest: world door → safe room → personal room → exits unwind", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;

    // The overworld shows a door, not an open sanctuary pad.
    expect(sim.world.tileAt(54, 54)).toBe(TILE.DoorSafeRoom);
    expect(sim.world.isSanctuary(54, 55)).toBe(false);
    teleport(entity, 54.5, 54.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();

    // Inside the region's shared safe room: sanctuary, doors, fixtures.
    const safe = safeRoomSpawn(1, 1);
    expect(entity.body.x).toBeCloseTo(safe.x, 3);
    expect(entity.body.y).toBeCloseTo(safe.y, 3);
    expect(sim.world.isSanctuary(Math.floor(safe.x), Math.floor(safe.y))).toBe(true);
    const safeF = safeRoomFeatures(1, 1);
    expect(sim.world.tileAt(safeF.doorPersonal.x, safeF.doorPersonal.y)).toBe(TILE.DoorPersonal);
    expect(sim.world.tileAt(safeF.doorParty.x, safeF.doorParty.y)).toBe(TILE.DoorParty);
    expect(sim.world.tileAt(safeF.exit.x, safeF.exit.y)).toBe(TILE.DoorExit);
    expect(sim.world.tileAt(safeF.stash.x, safeF.stash.y)).toBe(TILE.Stash);
    expect(sim.world.tileAt(safeF.table.x, safeF.table.y)).toBe(TILE.CraftingTable);

    // Personal door inside the safe room → your own room.
    teleport(entity, safeF.doorPersonal.x + 0.5, safeF.doorPersonal.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    const spawn = personalRoomSpawn(0); // first client gets slot 0
    expect(entity.body.x).toBeCloseTo(spawn.x, 3);
    expect(entity.body.y).toBeCloseTo(spawn.y, 3);
    const features = personalRoomFeatures(0);
    expect(sim.world.tileAt(features.stash.x, features.stash.y)).toBe(TILE.Stash);
    expect(sim.world.tileAt(features.table.x, features.table.y)).toBe(TILE.CraftingTable);
    expect(sim.world.isSanctuary(Math.floor(entity.body.x), Math.floor(entity.body.y))).toBe(true);

    // Exits unwind the stack: personal room → safe room → overworld.
    teleport(entity, features.exit.x + 0.5, features.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(safeF.doorPersonal.x + 0.5, 3);
    expect(entity.body.y).toBeCloseTo(safeF.doorPersonal.y + 0.5, 3);

    teleport(entity, safeF.exit.x + 0.5, safeF.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(54.5, 3);
    expect(entity.body.y).toBeCloseTo(54.5, 3);
  });

  it("the proving ground offers every epic's examples: weapons, hazards, enemies", () => {
    const a = sim.addPlayer("A", "client-a"); // spawns at TEST_SPAWN
    const snap = stepN(sim, 2).get(a.playerId)!;

    // Epic 4: ground items at spawn, including the starter weapons.
    const itemDefs = new Set(
      snap.entities.filter((e) => e.kind === "item").map((e) => e.defId),
    );
    for (const def of ["sword", "hammer", "bandage", "rag", "vodka-bottle"]) {
      expect(itemDefs, `missing ground item ${def}`).toContain(def);
    }

    // Epic 5: standing hazards, and they reseed after decaying.
    expect(sim.areas.defAt(34, 24)).toBe("area-fire");
    expect(sim.areas.defAt(18, 33)).toBe("area-poison");
    stepN(sim, TICK_RATE * 16); // > area-fire duration (8s) + reseed period
    expect(sim.areas.defAt(34, 24)).toBe("area-fire");

    // Epic 6: all four enemy kinds live in the proving ground.
    expect(sim.enemyCount).toBeGreaterThanOrEqual(5);
  });

  it("a picked-up sword out-damages fists", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const bEntity = sim.getPlayerEntity(b.playerId)!;

    // Walk onto the sword fixture and pick it up for real.
    teleport(aEntity, 30.5, 27.5, sim);
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

    // In the field: refused.
    sim.queueAction(a.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inv.some((s) => s?.item === "bandage")).toBe(false);

    // Next to the personal-room table: works and consumes inputs.
    const features = personalRoomFeatures(0);
    teleport(entity, features.table.x - 0.5, features.table.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "craft", recipe: "bandage" });
    sim.step();
    expect(inv.some((s) => s?.item === "bandage")).toBe(true);
    expect(inv.some((s) => s?.item === "rag")).toBe(false);
  });

  it("stash persists across sims (server restarts) via the store", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const features = personalRoomFeatures(0);
    teleport(entity, features.stash.x + 1.5, features.stash.y + 0.5, sim);
    sim.getInventory(a.playerId)![0] = { item: "knife", qty: 1 };
    sim.queueAction(a.playerId, { type: "stash", op: "put", index: 0 });
    const snaps = sim.step();
    const stashEvent = eventsOf(snaps, a.playerId).find((e) => e.t === "stash");
    expect(stashEvent && stashEvent.t === "stash" ? stashEvent.slots : []).toEqual([
      { item: "knife", qty: 1 },
    ]);

    // "Restart": a new sim sharing the same store.
    const sim2 = new GameSim(new World(SEED, 1), content, store, 99);
    const again = sim2.addPlayer("A", "client-a");
    const entity2 = sim2.getPlayerEntity(again.playerId)!;
    teleport(entity2, features.stash.x + 1.5, features.stash.y + 0.5, sim2);
    sim2.queueAction(again.playerId, { type: "stash", op: "take", index: 0 });
    sim2.step();
    expect(sim2.getInventory(again.playerId)![0]).toEqual({ item: "knife", qty: 1 });
  });
});

// ── helpers ────────────────────────────────────────────────────────

function makeParty(sim: GameSim): { aId: string; bId: string } {
  const a = sim.addPlayer("A", "client-a");
  const b = sim.addPlayer("B", "client-b");
  teleport(sim.getPlayerEntity(b.playerId)!, TEST_SPAWN.x + 2, TEST_SPAWN.y, sim);
  sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
  sim.step();
  sim.queueAction(b.playerId, { type: "party", op: "accept" });
  sim.step();
  return { aId: a.playerId, bId: b.playerId };
}

function nearbyAreaTile(sim: GameSim, x: number, y: number, tag: string): string | null {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      if (sim.areas.hasTagAt(tx, ty, tag)) return sim.areas.defAt(tx, ty);
    }
  }
  return null;
}
