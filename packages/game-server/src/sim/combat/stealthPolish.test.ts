import {
  GroundKind, STEALTH_TUNING, WorldChunkCache, sampleStealthExposure,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { CombatWorld } from "../combatSim.js";
import { computePlayerMoveMultiplier } from "./combatSimHelpers.js";
import { createStarterInventory } from "../playerInventory.js";
import { WorldEcology } from "../wildlife/worldEcology.js";

class FlatCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear() { return []; }
}

function makePlayer(id: string, x: number, y: number): CombatPlayerRef & { moving: boolean } {
  return {
    id, x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: true, inventory: createStarterInventory(), combat: createCombatState(), moving: false,
  };
}

describe("Phase 6 stealth polish & ecological AI refinements", () => {
  it("boosts stealth visibility via attackFlash window after swinging", () => {
    const cache = new FlatCache(1337);
    const baseline = sampleStealthExposure({ cache, x: 20, y: 12, dayPhase: 0.9, torchLit: false, crouching: true, moving: false, sprinting: false });
    const flashed = sampleStealthExposure({ cache, x: 20, y: 12, dayPhase: 0.9, torchLit: false, crouching: true, moving: false, sprinting: false, attackFlash: true });
    expect(flashed.lightLevel - baseline.lightLevel).toBeCloseTo(STEALTH_TUNING.attackFlashLightBoost, 2);
    expect(flashed.visibility).toBeGreaterThan(baseline.visibility);
  });

  it("applies Spider venom Poison DoT on bite with no movement slow, and prevents injured wolf ?/<> flicker", () => {
    const cw = new CombatWorld(new FlatCache(1337));
    const p = makePlayer("poison-victim", 20, 12);
    p.crouching = false;
    const map = new Map([[p.id, p]]);
    const spider = cw.ecology.spawnEntity({ kind: "spider", x: 21.0, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    spider.aiState = "chase"; spider.targetPlayerId = p.id; spider.attackCooldown = 0; spider.webShotCooldown = 99;

    const normalMult = computePlayerMoveMultiplier(p);
    for (let i = 0; i < 14; i++) {
      cw.stepPlayerAction({ player: p, players: map, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false } });
      cw.stepWorld({ players: map, dt: 0.05, dayPhase: 0.5, timeSec: i * 0.05 });
      if (p.combat.poisonTimer > 0) break;
    }
    expect(p.combat.poisonTimer).toBeGreaterThan(4.0);
    expect(computePlayerMoveMultiplier(p)).toBeCloseTo(normalMult, 3);
    const hpAfterBite = p.combat.hp;
    for (let i = 0; i < 28; i++) {
      cw.stepPlayerAction({ player: p, players: map, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false } });
    }
    expect(cw.drainEvents().some((e) => e.kind === "poisonTick" && e.targetId === p.id)).toBe(true);
    expect(p.combat.hp).toBeLessThan(hpAfterBite);

    const wEco = new WorldEcology(new FlatCache(1337));
    const wolf = wEco.spawnEntity({ kind: "wolf", x: 18, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    wolf.hp = Math.floor(wolf.maxHp * 0.2);
    wolf.targetPlayerId = p.id; wolf.aiState = "chase"; wolf.investigateTimer = 4.0;
    const seenStates = new Set<string>();
    for (let i = 0; i < 20; i++) {
      wEco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
      seenStates.add(wolf.aiState);
    }
    expect(seenStates.has("investigate")).toBe(false);
    expect(seenStates.has("flank")).toBe(false);
  });

  it("retreats injured Goblins toward nearby Orc allies and sweeps investigate facing angles", () => {
    const eco = new WorldEcology(new FlatCache(1337));
    const p = makePlayer("hero", 16, 12);
    p.crouching = false;
    const goblin = eco.spawnEntity({ kind: "goblin", x: 18, y: 12, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 0 });
    const orc = eco.spawnEntity({ kind: "orc", x: 24, y: 12, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 1 });
    goblin.hp = Math.max(1, Math.floor(goblin.maxHp * 0.2));
    goblin.targetPlayerId = p.id; goblin.aiState = "chase";
    orc.targetPlayerId = p.id; orc.aiState = "chase";
    const startDistToOrc = Math.hypot(orc.x - goblin.x, orc.y - goblin.y);
    for (let i = 0; i < 8; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
    expect(Math.hypot(orc.x - goblin.x, orc.y - goblin.y)).toBeLessThan(startDistToOrc);

    const wolf = eco.spawnEntity({ kind: "wolf", x: 40, y: 20, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    wolf.aiState = "investigate"; wolf.investigateTimer = 5.0; wolf.lastKnownX = 40.1; wolf.lastKnownY = 20.0;
    const angles = new Set<number>();
    for (let i = 0; i < 40; i++) {
      eco.step({ dt: 0.1, timeSec: i * 0.1, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
      angles.add(Math.round(Math.atan2(wolf.facingY, wolf.facingX) * 10));
    }
    expect(angles.size).toBeGreaterThanOrEqual(2);
  });
});
