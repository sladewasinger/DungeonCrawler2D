import { describe, expect, it } from "vitest";
import { GroundKind, STEALTH_TUNING, WorldChunkCache, type WorldEvent } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "./combatActions.js";
import { createStarterInventory } from "./playerInventory.js";
import { WorldEcology } from "./wildlife/worldEcology.js";

class FlatTestCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear() { return []; }
}

class CliffWallCache extends WorldChunkCache {
  override tileAt(wx: number) {
    return { ground: Math.floor(wx) <= 15 ? GroundKind.CliffStone : GroundKind.Grass, elevation: Math.floor(wx) <= 15 ? 2 : 0, stairs: false };
  }
  override propsNear() { return []; }
}

function makePlayer(x: number, y: number): CombatPlayerRef & { moving: boolean } {
  return {
    id: "p1", x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, inventory: createStarterInventory(), combat: createCombatState(), moving: false,
  };
}

describe("Phase 6 stealth and ecological AI", () => {
  it("lures calm creatures to investigate noise points and grants silent 2.25x backstab kills", () => {
    const eco = new WorldEcology(new FlatTestCache(1337));
    const gobA = eco.spawnEntity({ kind: "goblin", x: 20, y: 12, homeRadius: 10, poiId: "camp1", packId: "camp1", packSlot: 0 });
    const gobB = eco.spawnEntity({ kind: "goblin", x: 24, y: 12, homeRadius: 10, poiId: "camp1", packId: "camp1", packSlot: 1 });
    eco.emitNoise({ x: 22, y: 15, radius: 9 });
    expect(gobA.aiState).toBe("investigate");

    gobA.facingX = 1; gobA.facingY = 0; gobA.hp = 20; gobA.targetPlayerId = null;
    const sneakPlayer = makePlayer(18.7, 12);
    sneakPlayer.crouching = true;
    const events: WorldEvent[] = [];
    eco.hitSector({ attacker: sneakPlayer, dir: { x: 1, y: 0 }, damage: 15, range: 2.0, halfArcRad: 0.9, goreStyle: "thin-streak", events });
    const backstabEv = events.find((e) => e.kind === "backstab");
    expect(backstabEv?.value).toBe(Math.round(15 * STEALTH_TUNING.backstabDamageMult));
    expect(gobA.corpse).toBe(true);
    expect(gobB.alertedTimer).toBe(0);
  });

  it("rallies nearby wolves across groups via hive-mind and wall-stuns charging boars", () => {
    const eco = new WorldEcology(new FlatTestCache(1337));
    const wolf1 = eco.spawnEntity({ kind: "wolf", x: 20, y: 12, homeRadius: 12, poiId: null, packId: "packA", packSlot: 0 });
    const wolf2 = eco.spawnEntity({ kind: "wolf", x: 25, y: 12, homeRadius: 12, poiId: null, packId: "packB", packSlot: 0 });
    wolf1.facingX = 1; wolf1.facingY = 0;
    const p = makePlayer(22, 12);
    const events: WorldEvent[] = [];
    eco.step({ dt: 0.05, timeSec: 0, dayPhase: 0.5, players: [p], events, onStrike: () => {} });
    expect(wolf1.targetPlayerId).toBe("p1");
    expect(wolf2.targetPlayerId).toBe("p1");

    const cliffEco = new WorldEcology(new CliffWallCache(1337));
    const boar = cliffEco.spawnEntity({ kind: "boar", x: 16.4, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    boar.chargeVx = -10; boar.chargeVy = 0; boar.chargeTimer = 0.8;
    cliffEco.step({ dt: 0.05, timeSec: 0.05, dayPhase: 0.5, players: [makePlayer(24, 12)], events: [], onStrike: () => {} });
    expect(boar.staggerTimer).toBeGreaterThan(1.0);
    expect(boar.chargeTimer).toBe(0);
  });
});