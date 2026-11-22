import { describe, expect, it } from "vitest";
import { AI_TUNING, WorldChunkCache, isInSanctuary } from "@dc2d/engine";
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
  it("spawns POI chests, opens on interact, and magnetically pulls loot into inventory", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const p = makePlayer(45, 16);
    eco.ensureAroundPlayers([p]);
    const chests = eco.snapshots().chests;
    expect(chests.length).toBeGreaterThan(0);
    const chest = chests[0]!;
    p.x = chest.x + 0.4;
    p.y = chest.y + 0.4;
    const events: import("@dc2d/engine").WorldEvent[] = [];
    expect(eco.tryInteractChest(p, events)).toBe(true);
    expect(events.some((e) => e.kind === "chestOpen")).toBe(true);
    expect(eco.snapshots().groundLoot.length).toBeGreaterThan(0);

    const arrowsBefore = p.inventory.slots[2]?.count ?? 0;
    for (let i = 0; i < 40; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events, onStrike: () => {} });
    const arrowsAfter = p.inventory.slots[2]?.count ?? 0;
    expect(arrowsAfter).toBeGreaterThanOrEqual(arrowsBefore);
    expect(events.some((e) => e.kind === "loot")).toBe(true);
  });

  it("keeps dead bodies non-aggressive and draws hungry bears to feed on corpses", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const boar = eco.spawnEntity({ kind: "boar", x: 24, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    const bear = eco.spawnEntity({ kind: "bear", x: 26, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    bear.hunger = 0.9;
    const events: import("@dc2d/engine").WorldEvent[] = [];
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
});
