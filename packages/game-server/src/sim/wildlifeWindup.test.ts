import { describe, expect, it } from "vitest";
import { GroundKind, WorldChunkCache, type WorldEvent } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "./combatActions.js";
import { craftPlayerRecipe, createStarterInventory } from "./playerInventory.js";
import { WorldEcology } from "./wildlife/worldEcology.js";

class FlatGrassCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear() { return []; }
}

class SheerWallCache extends WorldChunkCache {
  override tileAt(wx: number) {
    const blocked = Math.floor(wx) >= 26;
    return { ground: blocked ? GroundKind.CliffStone : GroundKind.Grass, elevation: blocked ? 2 : 0, stairs: false };
  }
  override propsNear() { return []; }
}

function makePlayer(x: number, y: number, elevation = 0): CombatPlayerRef & { moving: boolean } {
  return {
    id: "p1", x, y, elevation, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, inventory: createStarterInventory(), combat: createCombatState(), moving: false,
  };
}

function stepEco(opts: {
  readonly eco: WorldEcology;
  readonly players: readonly (CombatPlayerRef & { moving: boolean })[];
  readonly ticks: number;
  readonly events?: WorldEvent[];
}): void {
  const events = opts.events ?? [];
  for (let i = 0; i < opts.ticks; i++) {
    opts.eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: opts.players, events, onStrike: () => {} });
  }
}

describe("wildlife windup completion and cancellation", () => {
  it("cancels a skeleton melee windup immediately when its rival target dies mid-windup", () => {
    const eco = new WorldEcology(new FlatGrassCache(1337));
    const skel = eco.spawnEntity({ kind: "skeleton", x: 24, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    const bear = eco.spawnEntity({ kind: "bear", x: 25.1, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    skel.facingX = 1; skel.facingY = 0; skel.attackCooldown = 0;
    bear.facingX = -1; bear.facingY = 0; bear.attackCooldown = 5;

    stepEco({ eco, players: [], ticks: 2 });
    expect(skel.targetPlayerId).toBe(bear.id);
    expect(skel.telegraphTimer).toBeGreaterThan(0);

    eco.damageEntity({ entity: bear, damage: 999, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: "p1", events: [] });
    expect(bear.corpse).toBe(true);

    stepEco({ eco, players: [], ticks: 1 });
    const skelSnap = eco.snapshots().entities.find((m) => m.id === skel.id);
    expect(skel.telegraphTimer).toBe(0);
    expect(skelSnap?.telegraphProgress).toBe(0);
  });

  it("finishes a committed melee windup instead of freezing when its live target breaks line of sight", () => {
    const eco = new WorldEcology(new SheerWallCache(1337));
    const skel = eco.spawnEntity({ kind: "skeleton", x: 24.5, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    skel.facingX = 1; skel.facingY = 0; skel.attackCooldown = 0;
    const player = makePlayer(25.4, 12, 0);

    stepEco({ eco, players: [player], ticks: 2 });
    expect(skel.telegraphTimer).toBeGreaterThan(0);

    player.x = 29;
    player.elevation = 2;
    const events: WorldEvent[] = [];
    stepEco({ eco, players: [player], ticks: 12, events });

    expect(skel.telegraphTimer).toBe(0);
    expect(events.some((ev) => ev.kind === "swing" && ev.actorId === skel.id)).toBe(true);
  });

  it("cancels a boar charge windup instead of locking in charge pose when its target dies", () => {
    const eco = new WorldEcology(new FlatGrassCache(1337));
    const boar = eco.spawnEntity({ kind: "boar", x: 20, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    const bear = eco.spawnEntity({ kind: "bear", x: 24, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    boar.facingX = 1; boar.facingY = 0; boar.attackCooldown = 0;
    bear.attackCooldown = 5;

    stepEco({ eco, players: [], ticks: 2 });
    expect(boar.aiState).toBe("charge");
    expect(boar.telegraphTimer).toBeGreaterThan(0);

    eco.damageEntity({ entity: bear, damage: 999, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: "p1", events: [] });
    stepEco({ eco, players: [], ticks: 1 });

    expect(boar.telegraphTimer).toBe(0);
    expect(boar.aiState).not.toBe("charge");
  });

  it("clears bear bluff state when target disappears and supports crafting the Hunter Bow", () => {
    const eco = new WorldEcology(new FlatGrassCache(1337));
    const bear = eco.spawnEntity({ kind: "bear", x: 20, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    const player = makePlayer(26, 12, 0);
    bear.facingX = 1; bear.facingY = 0;

    stepEco({ eco, players: [player], ticks: 2 });
    expect(bear.bluffTimer).toBeGreaterThan(0);

    stepEco({ eco, players: [], ticks: 1 });
    expect(bear.bluffTimer).toBe(0);

    const inv = createStarterInventory();
    inv.slots[10] = { itemId: "wood", count: 5 };
    inv.slots[11] = { itemId: "herb", count: 2 };
    const crafted = craftPlayerRecipe(inv, { recipeId: "craft-bow", nearCampfire: false });
    expect(crafted).not.toBeNull();
    expect(crafted?.slots.some((s) => s?.itemId === "bow" && s.count === 1)).toBe(true);
  });
});
