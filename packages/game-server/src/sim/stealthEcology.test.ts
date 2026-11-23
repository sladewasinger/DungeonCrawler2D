import { describe, expect, it } from "vitest";
import { GroundKind, PropKind, STEALTH_TUNING, WorldChunkCache, type ChunkProp, type WorldEvent } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "./combatActions.js";
import { CombatWorld } from "./combatSim.js";
import { createStarterInventory } from "./playerInventory.js";
import { createArrowProjectile, stepProjectileList } from "./wildlife/projectileSim.js";
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

class PropPhysicsCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear(): readonly ChunkProp[] {
    return [
      { id: "boulder", kind: PropKind.Boulder, x: 22, y: 10, variant: 0, elevation: 0, radius: 0.45, blocksMovement: true },
      { id: "stump", kind: PropKind.Stump, x: 24, y: 12, variant: 0, elevation: 0, radius: 0.35, blocksMovement: true },
      { id: "tree", kind: PropKind.PineTree, x: 26, y: 14, variant: 0, elevation: 0, radius: 0.38, blocksMovement: true },
    ];
  }
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
    const sneakPlayer = makePlayer(18.7, 12); sneakPlayer.crouching = true;
    const events: WorldEvent[] = [];
    eco.hitSector({ attacker: sneakPlayer, dir: { x: 1, y: 0 }, damage: 15, range: 2.0, halfArcRad: 0.9, goreStyle: "thin-streak", events });
    const backstabEv = events.find((e) => e.kind === "backstab");
    expect(backstabEv?.value).toBe(Math.round(15 * STEALTH_TUNING.backstabDamageMult));
    expect(gobA.corpse).toBe(true);
    expect(gobB.alertedTimer).toBe(0);
  });

  it("locks non-boar windup attack facing, rallies wolves with howl, and applies 1.35x dmg after boar wall-stun", () => {
    const eco = new WorldEcology(new FlatTestCache(1337));
    const bear = eco.spawnEntity({ kind: "bear", x: 20, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    bear.attackCooldown = 0;
    const p = makePlayer(21.2, 12);
    let strikes = 0;
    eco.step({ dt: 0.05, timeSec: 0, dayPhase: 0.5, players: [p], events: [], onStrike: () => { strikes += 1; } });
    expect(bear.telegraphTimer).toBeGreaterThan(0);
    p.x = 18.8; // Roll behind the rearing bear before the swing lands
    for (let i = 0; i < 12; i++) eco.step({ dt: 0.05, timeSec: 0.1 + i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => { strikes += 1; } });
    expect(strikes).toBe(0);

    const wolf1 = eco.spawnEntity({ kind: "wolf", x: 10, y: 22, homeRadius: 12, poiId: null, packId: "packA", packSlot: 0 });
    const wolf2 = eco.spawnEntity({ kind: "wolf", x: 15, y: 22, homeRadius: 12, poiId: null, packId: "packB", packSlot: 0 });
    wolf1.facingX = 1; wolf1.facingY = 0;
    const wp = makePlayer(12, 22);
    const howlEvs: WorldEvent[] = [];
    for (let i = 0; i < 16; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [wp], events: howlEvs, onStrike: () => {} });
    expect(howlEvs.some((e) => e.kind === "wolfHowl")).toBe(true);
    expect(wolf2.targetPlayerId).toBe("p1");

    const cliffEco = new WorldEcology(new CliffWallCache(1337));
    const boar = cliffEco.spawnEntity({ kind: "boar", x: 16.4, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    boar.chargeVx = -10; boar.chargeVy = 0; boar.chargeTimer = 0.8;
    const crashEvs: WorldEvent[] = [];
    cliffEco.step({ dt: 0.05, timeSec: 0.05, dayPhase: 0.5, players: [makePlayer(24, 12)], events: crashEvs, onStrike: () => {} });
    expect(boar.stunnedTimer).toBeGreaterThan(1.0);
    expect(crashEvs.some((e) => e.kind === "boarCrash")).toBe(true);
    const hpBefore = boar.hp;
    cliffEco.damageEntity({ entity: boar, damage: 20, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: "p1", events: [] });
    expect(hpBefore - boar.hp).toBe(Math.round(20 * 1.35));
  });

  it("embeds arrows only in tree trunks, glides over boulders/stumps, wakes hit spiders, and collects arrows manually", () => {
    const cache = new PropPhysicsCache(1337);
    const eco = new WorldEcology(cache);
    const p = makePlayer(20, 10);
    const players = new Map<string, CombatPlayerRef>([[p.id, p]]);
    const overBoulder = createArrowProjectile({ id: "a1", p, speed: 20, charge: 1, damage: 20 });
    stepProjectileList({ cache, projectiles: [overBoulder], dummies: [], ecology: eco, players, events: [], dt: 0.2 });
    expect(eco.loot.groundLoot).toHaveLength(0);

    const pTree = makePlayer(24, 13.45);
    const overCanopy = createArrowProjectile({ id: "a2", p: pTree, speed: 20, charge: 1, damage: 20 });
    stepProjectileList({ cache, projectiles: [overCanopy], dummies: [], ecology: eco, players, events: [], dt: 0.2 });
    expect(eco.loot.groundLoot).toHaveLength(0);

    const pTrunk = makePlayer(24, 14);
    const intoTrunk = createArrowProjectile({ id: "a3", p: pTrunk, speed: 20, charge: 1, damage: 20 });
    stepProjectileList({ cache, projectiles: [intoTrunk], dummies: [], ecology: eco, players, events: [], dt: 0.2 });
    expect(eco.loot.groundLoot).toHaveLength(1);
    expect(eco.loot.groundLoot[0]?.manualPickup).toBe(true);

    p.x = 26; p.y = 14;
    eco.loot.step([p], [], 0.5);
    expect(eco.loot.groundLoot).toHaveLength(1);
    expect(eco.pickupManualLoot(p, undefined, [])).toBe(true);
    expect(eco.loot.groundLoot).toHaveLength(0);

    const spider = eco.spawnEntity({ kind: "spider", x: 35, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    spider.aiState = "ambush";
    eco.damageEntity({ entity: spider, damage: 12, dirX: 1, dirY: 0, goreStyle: "drip", actorId: "remote-sniper", events: [] });
    expect(spider.aiState).toBe("investigate");
    expect(spider.investigateTimer).toBeGreaterThan(5);
  });

  it("supports dynamic multi-faction wildlife vs goblin and wildlife vs wildlife combat and parabolic pebbles", () => {
    const cache = new FlatTestCache(1337);
    const eco = new WorldEcology(cache);
    const skeleton = eco.spawnEntity({ kind: "skeleton", x: 10, y: 12, homeRadius: 12, poiId: "ruin1", packId: "ruin1", packSlot: 0 });
    const golem = eco.spawnEntity({ kind: "golem", x: 11.2, y: 12, homeRadius: 12, poiId: "ruin1", packId: "ruin1", packSlot: 1 });
    skeleton.facingX = 1; golem.facingX = -1;
    const goblinAlly = eco.spawnEntity({ kind: "goblin", x: 10, y: 24, homeRadius: 12, poiId: "camp1", packId: "camp1", packSlot: 0 });
    const orcAlly = eco.spawnEntity({ kind: "orc", x: 11.2, y: 24, homeRadius: 12, poiId: "camp1", packId: "camp1", packSlot: 1 });
    goblinAlly.facingX = 1; orcAlly.facingX = -1;
    for (let i = 0; i < 20; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [makePlayer(60, 60)], events: [], onStrike: () => {} });
    expect(skeleton.hp).toBe(skeleton.maxHp);
    expect(golem.hp).toBe(golem.maxHp);
    expect(goblinAlly.hp).toBe(goblinAlly.maxHp);
    expect(orcAlly.hp).toBe(orcAlly.maxHp);

    const wolf = eco.spawnEntity({ kind: "wolf", x: 20, y: 12, homeRadius: 12, poiId: null, packId: "w1", packSlot: 0 });
    const goblin = eco.spawnEntity({ kind: "goblin", x: 21.1, y: 12, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 0 });
    wolf.facingX = 1; wolf.facingY = 0; goblin.facingX = -1; goblin.facingY = 0;
    const events: WorldEvent[] = [];
    for (let i = 0; i < 30; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [makePlayer(60, 60)], events, onStrike: () => {} });
    expect(wolf.hp < wolf.maxHp || goblin.hp < goblin.maxHp).toBe(true);

    const cw = new CombatWorld(cache);
    const gob = cw.ecology.spawnEntity({ kind: "goblin", x: 24, y: 10, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    const thrower = makePlayer(20, 10);
    const pMap = new Map<string, CombatPlayerRef>([[thrower.id, thrower]]);
    cw.stepPlayerAction({ player: thrower, players: pMap, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false, throwPebble: true }, dt: 0.05 });
    for (let i = 0; i < 12; i++) cw.stepWorld({ players: pMap, dt: 0.05, dayPhase: 0.5, timeSec: i * 0.05 });
    const cwEvs = cw.drainEvents();
    expect(cwEvs.some((e) => e.kind === "pebbleLand")).toBe(true);
    expect(gob.aiState).toBe("investigate");
  });
});
