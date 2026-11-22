import { LEVEL, PLAYER_MAX_HP, PLAYER_MAX_STAMINA, World, xpForLevel } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { GameSim } from "../core/index.js";
import { SEED, content, findFlatArena, makeSim, stepN, teleport } from "../integration/support.js";

describe("Checkpoint 1: level scaling, armor sets, and bow combat", () => {
  it("scales player stats on level-up and one-shots a 12-HP slime at level 4 with the rusty sword", () => {
    const store = new PlayerStore(null);
    const sim = new GameSim({
      world: new World(SEED, 0, LEVEL.Sandbox),
      content,
      store,
      rngSeed: 1234,
      opts: { freezeEnemies: true },
    });
    const arena = findFlatArena({ sim, anchor: { x: 28, y: 28 } });
    const joined = sim.addPlayer({ name: "Hero", clientId: "level-scaling-hero" });
    const player = sim.getPlayerEntity(joined.playerId)!;
    teleport({ entity: player, x: arena.x, y: arena.y, sim });

    const initialSnap = sim.step().get(joined.playerId)!;
    expect(initialSnap.self.maxHp).toBe(PLAYER_MAX_HP);
    expect(initialSnap.self.maxStamina).toBe(PLAYER_MAX_STAMINA);

    // Grant XP to reach Level 4 via store + sync by killing a dummy enemy
    const stored = store.get("level-scaling-hero", "Hero");
    stored.xp = xpForLevel(4) - 1;
    stored.level = 3;
    const xpSlime = sim.spawnEnemy("slime", player.body.x + 1, player.body.y);
    xpSlime.hp = 1;
    sim.queueAction(joined.playerId, { type: "attack", dirX: 1, dirY: 0 });
    stepN(sim, 10);

    const lv4Snap = sim.step().get(joined.playerId)!;
    expect(lv4Snap.self.level).toBe(4);
    expect(lv4Snap.self.maxHp).toBe(PLAYER_MAX_HP + 15);
    expect(lv4Snap.self.maxStamina).toBe(PLAYER_MAX_STAMINA + 60);

    // Spawn a fresh full-health 12-HP Slime and verify one Rusty Sword swing kills it
    const freshSlime = sim.spawnEnemy("slime", player.body.x + 1, player.body.y);
    expect(freshSlime.hp).toBe(12);
    sim.queueAction(joined.playerId, { type: "attack", dirX: 1, dirY: 0 });
    stepN(sim, 3);
    expect(freshSlime.hp).toBeLessThanOrEqual(0);
  });

  it("equips 4-slot armor sets and applies Max HP bonus and incoming damage reduction", () => {
    const sim = makeSim(1234, { freezeEnemies: true });
    const joined = sim.addPlayer({ name: "Tank", clientId: "armor-tank" });
    const inv = sim.getInventory(joined.playerId)!;
    const pieces = ["grizzly-helm", "grizzly-cuirass", "grizzly-greaves", "grizzly-boots"] as const;
    for (const item of pieces) {
      inv.push({ item, qty: 1 });
      sim.queueAction(joined.playerId, { type: "equip", item });
    }
    const snap = sim.step().get(joined.playerId)!;

    expect(snap.self.armor).toEqual({
      head: pieces[0],
      chest: pieces[1],
      legs: pieces[2],
      boots: pieces[3],
    });
    expect(snap.self.maxHp).toBe(PLAYER_MAX_HP + 20);
    expect(snap.self.hp).toBe(PLAYER_MAX_HP + 20);
  });

  it("fires arrows from the Hunter's Bow with hold-to-draw scaling and awards XP on kill", () => {
    const sim = makeSim(1234, { freezeEnemies: true });
    const arena = findFlatArena({ sim, anchor: { x: 28, y: 28 }, clearance: 4 });
    const joined = sim.addPlayer({ name: "Archer", clientId: "bow-archer" });
    const player = sim.getPlayerEntity(joined.playerId)!;
    teleport({ entity: player, x: arena.x, y: arena.y, sim });

    const inv = sim.getInventory(joined.playerId)!;
    inv.push({ item: "bow", qty: 1 }, { item: "arrow", qty: 4 });
    sim.queueAction(joined.playerId, { type: "equip", item: "bow" });
    sim.step();

    const slime = sim.spawnEnemy("slime", player.body.x + 3, player.body.y);
    expect(slime.hp).toBe(12);

    sim.queueAction(joined.playerId, { type: "attack", dirX: 1, dirY: 0, drawRatio: 1 });
    stepN(sim, 15);

    expect(slime.hp).toBeLessThanOrEqual(0);
    expect(inv.find((stack) => stack.item === "arrow")?.qty).toBe(3);
    const snap = sim.step().get(joined.playerId)!;
    expect(snap.self.xp).toBeGreaterThan(0);
  });

  it("alerts timber wolf packmates together and cooks raw meat at a campfire on interact", () => {
    const sim = makeSim(1234);
    const arena = findFlatArena({ sim, anchor: { x: 28, y: 28 }, clearance: 6 });
    const joined = sim.addPlayer({ name: "Hunter", clientId: "forest-hunter" });
    const player = sim.getPlayerEntity(joined.playerId)!;
    teleport({ entity: player, x: arena.x, y: arena.y, sim });
    sim.endSpawnGrace(joined.playerId);

    // Spawn two wolves: one inside aggro range (10 tiles), one slightly outside (13.5 tiles) but within pack alert distance of wolf 1
    const wolf1 = sim.spawnEnemy("wolf", player.body.x + 8, player.body.y);
    const wolf2 = sim.spawnEnemy("wolf", player.body.x + 13.5, player.body.y);
    const w2StartX = wolf2.body.x;
    stepN(sim, 10);
    expect(wolf1.body.x).toBeLessThan(player.body.x + 8);
    expect(wolf2.body.x).toBeLessThan(w2StartX);

    // Place a burning torch/campfire and cook Raw Meat into Cooked Meat
    const inv = sim.getInventory(joined.playerId)!;
    inv.push({ item: "raw-meat", qty: 2 });
    sim.queueAction(joined.playerId, { type: "useSlot", slot: 1, targetX: player.body.x + 0.5, targetY: player.body.y });
    stepN(sim, 15);
    sim.queueAction(joined.playerId, { type: "interact" });
    sim.step();
    expect(inv.find((s) => s.item === "cooked-meat")?.qty).toBe(1);
    expect(inv.find((s) => s.item === "raw-meat")?.qty).toBe(1);
  });
});
