import { describe, expect, it } from "vitest";
import { AI_TUNING, WorldChunkCache, isInSanctuary, type WorldEvent } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { createStarterInventory } from "../playerInventory.js";
import { WorldEcology } from "./worldEcology.js";

function makePlayer(x: number, y: number): CombatPlayerRef & { moving: boolean } {
  return {
    id: "p1", x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, inventory: createStarterInventory(), combat: createCombatState(), moving: false,
  };
}

describe("WorldEcology & POIs", () => {
  it("opens 27-slot POI chests without bursting, supports bidirectional transfer/take-all, and magnetically loots enemy drops", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const p = makePlayer(45, 16);
    eco.ensureAroundPlayers([p]);
    const chests = eco.snapshots().chests;
    expect(chests.length).toBeGreaterThan(0);
    const chest = chests[0]!;
    expect(chest.slots).toHaveLength(27);
    expect(chest.slots[0]).not.toBeNull();
    p.x = chest.x + 0.4;
    p.y = chest.y + 0.4;
    const events: WorldEvent[] = [];
    expect(eco.openChest(p, chest.id, events)).toBe(chest.id);
    expect(events.some((e) => e.kind === "chestOpen")).toBe(true);
    expect(eco.snapshots().groundLoot).toHaveLength(0);

    expect(eco.transferChest(p, { chestId: chest.id, from: "inv", fromSlot: 11, to: "chest", toSlot: 20 })).toBe(true);
    expect(eco.snapshots().chests.find((c) => c.id === chest.id)?.slots[20]).not.toBeNull();
    expect(eco.takeAllChest(p, chest.id, events)).toBeGreaterThan(0);

    const goblin = eco.spawnEntity({ kind: "goblin", x: chest.x + 1.1, y: chest.y, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    eco.damageEntity({ entity: goblin, damage: 999, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: "p1", events });
    expect(eco.snapshots().groundLoot.length).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events, onStrike: () => {} });
    expect(events.some((e) => e.kind === "loot")).toBe(true);
  });

  it("keeps dead bodies non-aggressive and draws hungry bears to feed on corpses", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const boar = eco.spawnEntity({ kind: "boar", x: 24, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    const bear = eco.spawnEntity({ kind: "bear", x: 26, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    bear.hunger = 0.9;
    const events: WorldEvent[] = [];
    eco.damageEntity({ entity: boar, damage: 999, dirX: 1, dirY: 0, goreStyle: "chunk-spray", actorId: "p1", events });
    expect(boar.corpse).toBe(true);

    let strikes = 0;
    const p = makePlayer(24.5, 12);
    for (let i = 0; i < 30; i++) {
      eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events, onStrike: () => { strikes++; } });
    }
    expect(bear.aiState).toBe("feed");
    expect(strikes).toBe(0);
    expect(AI_TUNING.corpseDurationSec).toBe(18);
  });

  it("enforces sanctuary safety so wildlife never strike inside spawn radius", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const wolf = eco.spawnEntity({ kind: "wolf", x: 8.5, y: 0.5, homeRadius: 12, poiId: null, packId: "w1", packSlot: 0 });
    const safePlayer = makePlayer(0.5, 0.5);
    expect(isInSanctuary(safePlayer.x, safePlayer.y)).toBe(true);
    let strikes = 0;
    for (let i = 0; i < 25; i++) {
      eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [safePlayer], events: [], onStrike: () => { strikes++; } });
    }
    expect(strikes).toBe(0);
    expect(wolf.aiState).not.toBe("chase");
  });

  it("drives boar mid-range charge and close-range tusk melee without center-stacking or jitter", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const boar = eco.spawnEntity({ kind: "boar", x: 25.5, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    boar.facingX = -1;
    boar.facingY = 0;
    const p = makePlayer(22, 12);
    let strikes = 0;
    for (let i = 0; i < 40; i++) {
      eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => { strikes++; } });
    }
    expect(strikes).toBeGreaterThanOrEqual(1);

    boar.attackCooldown = 0;
    boar.chargeTimer = 0;
    boar.chargeRecoverTimer = 0;
    boar.telegraphTimer = 0;
    boar.x = 22.85;
    boar.y = 12;
    const before = strikes;
    for (let i = 0; i < 30; i++) {
      eco.step({ dt: 0.05, timeSec: (40 + i) * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => { strikes++; } });
      expect(Math.hypot(boar.x - p.x, boar.y - p.y)).toBeGreaterThanOrEqual(0.55);
    }
    expect(strikes).toBeGreaterThan(before);
  });

  it("maintains ally separation and combat standoff radius around players", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const g1 = eco.spawnEntity({ kind: "goblin", x: 24, y: 12, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 0 });
    const g2 = eco.spawnEntity({ kind: "goblin", x: 24.1, y: 12.05, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 1 });
    const p = makePlayer(22.5, 12);
    for (let i = 0; i < 35; i++) {
      eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
    }
    expect(Math.hypot(g1.x - g2.x, g1.y - g2.y)).toBeGreaterThan(0.35);
    expect(Math.hypot(g1.x - p.x, g1.y - p.y)).toBeGreaterThan(0.7);
    expect(Math.hypot(g2.x - p.x, g2.y - p.y)).toBeGreaterThan(0.7);
  });

  it("prunes distant spawn entities and spawns fresh encounters when travelling far northwest", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const p = makePlayer(45, 16);
    const events: WorldEvent[] = [];
    eco.step({ dt: 0.05, timeSec: 0, dayPhase: 0.5, players: [p], events, onStrike: () => {} });
    const originIds = new Set(eco.list.map((e) => e.id));
    expect(originIds.size).toBeGreaterThan(0);

    p.x = -320;
    p.y = -320;
    eco.step({ dt: 0.05, timeSec: 1, dayPhase: 0.5, players: [p], events, onStrike: () => {} });
    expect(eco.list.some((e) => originIds.has(e.id))).toBe(false);
    expect(eco.list.length).toBeGreaterThan(0);
    expect(eco.list.every((e) => Math.hypot(e.x - p.x, e.y - p.y) <= 96)).toBe(true);
  });
});
