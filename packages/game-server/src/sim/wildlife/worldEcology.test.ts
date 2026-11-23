import { describe, expect, it } from "vitest";
import { AI_TUNING, GroundKind, WorldChunkCache, findChunkPoi, findTilePath, isInSanctuary, type WorldEvent } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { createStarterInventory } from "../playerInventory.js";
import { WorldEcology } from "./worldEcology.js";

class ForestCoverCache extends WorldChunkCache {
  override tileAt(wx: number) {
    return { ground: Math.floor(wx) < 15 ? GroundKind.ForestFloor : GroundKind.Grass, elevation: 0, stairs: false };
  }
  override propsNear() { return []; }
}

class RiverBarrierCache extends WorldChunkCache {
  override tileAt(wx: number) {
    if (Math.floor(wx) === 28) return { ground: GroundKind.DeepWater, elevation: 0, stairs: false };
    return { ground: GroundKind.Grass, elevation: 0, stairs: false };
  }
  override propsNear() { return []; }
}

function makePlayer(x: number, y: number): CombatPlayerRef & { moving: boolean } {
  return {
    id: "p1", x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, inventory: createStarterInventory(), combat: createCombatState(), moving: false,
  };
}

function stepEco(opts: {
  readonly eco: WorldEcology; readonly players: readonly (CombatPlayerRef & { moving: boolean })[];
  readonly ticks: number; readonly dayPhase?: number; readonly onStrike?: () => void;
}): void {
  const events: WorldEvent[] = [];
  for (let i = 0; i < opts.ticks; i++) {
    opts.eco.step({
      dt: 0.05, timeSec: i * 0.05, dayPhase: opts.dayPhase ?? 0.5,
      players: opts.players, events, onStrike: opts.onStrike ?? (() => {}),
    });
  }
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
    const eco = new WorldEcology(new WorldChunkCache(1337));
    const boar = eco.spawnEntity({ kind: "boar", x: 24, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    const bear = eco.spawnEntity({ kind: "bear", x: 26, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    bear.hunger = 0.9;
    eco.damageEntity({ entity: boar, damage: 999, dirX: 1, dirY: 0, goreStyle: "chunk-spray", actorId: "p1", events: [] });
    expect(boar.corpse).toBe(true);

    let strikes = 0;
    stepEco({ eco, players: [makePlayer(24.5, 12)], ticks: 30, onStrike: () => { strikes++; } });
    expect(bear.aiState).toBe("feed");
    expect(strikes).toBe(0);
    expect(AI_TUNING.corpseDurationSec).toBe(18);
  });

  it("enforces sanctuary safety so wildlife never strike inside spawn radius", () => {
    const eco = new WorldEcology(new WorldChunkCache(1337));
    const wolf = eco.spawnEntity({ kind: "wolf", x: 8.5, y: 0.5, homeRadius: 12, poiId: null, packId: "w1", packSlot: 0 });
    const safePlayer = makePlayer(0.5, 0.5);
    expect(isInSanctuary(safePlayer.x, safePlayer.y)).toBe(true);
    let strikes = 0;
    stepEco({ eco, players: [safePlayer], ticks: 25, onStrike: () => { strikes++; } });
    expect(strikes).toBe(0);
    expect(wolf.aiState).not.toBe("chase");
  });

  it("drives boar mid-range charge and close-range tusk melee without center-stacking or jitter", () => {
    const eco = new WorldEcology(new WorldChunkCache(1337));
    const boar = eco.spawnEntity({ kind: "boar", x: 25.5, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    boar.facingX = -1;
    boar.facingY = 0;
    const p = makePlayer(22, 12);
    let strikes = 0;
    stepEco({ eco, players: [p], ticks: 40, onStrike: () => { strikes++; } });
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
    const eco = new WorldEcology(new WorldChunkCache(1337));
    const g1 = eco.spawnEntity({ kind: "goblin", x: 24, y: 12, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 0 });
    const g2 = eco.spawnEntity({ kind: "goblin", x: 24.1, y: 12.05, homeRadius: 12, poiId: "c1", packId: "c1", packSlot: 1 });
    const p = makePlayer(22.5, 12);
    stepEco({ eco, players: [p], ticks: 35 });
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

  it("enforces territorial guard leash for orcs while roaming wolves pursue far until outrun", () => {
    const eco = new WorldEcology(new ForestCoverCache(1337));
    const orc = eco.spawnEntity({ kind: "orc", x: 20, y: 12, homeRadius: 6, poiId: null, packId: null, packSlot: 0 });
    orc.facingX = 1;
    orc.facingY = 0;
    const p = makePlayer(25.5, 12);
    for (let i = 0; i < 28; i++) eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
    expect(["chase", "alert"]).toContain(orc.aiState);

    p.x = 29.2;
    for (let i = 0; i < 6; i++) {
      eco.step({ dt: 0.05, timeSec: 1.4 + i * 0.05, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
      expect(orc.aiState).toBe("return");
    }
    expect(orc.facingX).toBeLessThan(0);

    // Returning inside guard territory (<= homeRadius * 1.15) re-aggros orc without needing damage.
    p.x = 26.2;
    eco.step({ dt: 0.05, timeSec: 1.75, dayPhase: 0.5, players: [p], events: [], onStrike: () => {} });
    expect(orc.aiState).not.toBe("return");

    // Non-territorial wolf chases well past its home radius until outrun.
    const wolf = eco.spawnEntity({ kind: "wolf", x: 20, y: 20, homeRadius: 6, poiId: null, packId: null, packSlot: 0 });
    wolf.facingX = 1;
    wolf.facingY = 0;
    const runner = makePlayer(26, 20);
    for (let i = 0; i < 45; i++) {
      runner.x += 0.16;
      eco.step({ dt: 0.05, timeSec: 2 + i * 0.05, dayPhase: 0.5, players: [runner], events: [], onStrike: () => {} });
    }
    expect(wolf.x - wolf.homeX).toBeGreaterThan(wolf.homeRadius * 1.45);
    expect(wolf.aiState).not.toBe("return");
  });

  it("keeps golems stationary idle when calm and lets enemies jump up 1-tile ledges", () => {
    const eco = new WorldEcology(new ForestCoverCache(1337));
    const golem = eco.spawnEntity({ kind: "golem", x: 20, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    stepEco({ eco, players: [], ticks: 30 });
    expect(golem.aiState).toBe("idle");
    expect(golem.x).toBe(20);

    class OneTileWallCache extends WorldChunkCache {
      override tileAt(_wx: number, wy: number) {
        return { ground: GroundKind.Grass, elevation: Math.floor(wy) <= -8 ? 1 : 0, stairs: false };
      }
      override propsNear() { return []; }
    }
    const cliffEco = new WorldEcology(new OneTileWallCache(1337));
    const wolf = cliffEco.spawnEntity({ kind: "wolf", x: -7.5, y: -6.5, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    wolf.facingX = 0;
    wolf.facingY = -1;
    const cliffPlayer = makePlayer(-7.5, -10.5);
    cliffPlayer.elevation = 1;
    stepEco({ eco: cliffEco, players: [cliffPlayer], ticks: 55 });
    expect(wolf.elevation).toBe(1);
  });

  it("scales knockback by archetype resistance, climbs cliff stairs, and disengages unreachable ledges", () => {
    const barrierEco = new WorldEcology(new RiverBarrierCache(1337));
    const slime = barrierEco.spawnEntity({ kind: "slime", x: 20, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    const golem = barrierEco.spawnEntity({ kind: "golem", x: 20, y: 18, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    barrierEco.damageEntity({ entity: slime, damage: 12, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: "p1", events: [] });
    barrierEco.damageEntity({ entity: golem, damage: 12, dirX: 1, dirY: 0, goreStyle: "chunk-spray", actorId: "p1", events: [] });
    expect(slime.kbVx).toBeGreaterThan(golem.kbVx * 3);
    stepEco({ eco: barrierEco, players: [], ticks: 3 });
    expect(slime.x - 20).toBeGreaterThan((golem.x - 20) * 2);

    const goblin = barrierEco.spawnEntity({ kind: "goblin", x: 23, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    goblin.facingX = 1;
    stepEco({ eco: barrierEco, players: [makePlayer(29.5, 12)], ticks: 80 });
    expect(goblin.x).toBeLessThan(28);
    expect(goblin.aiState).toBe("return");

    const stairEco = new WorldEcology(new WorldChunkCache(1337));
    const climber = stairEco.spawnEntity({ kind: "goblin", x: -6.5, y: -5.5, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    climber.facingX = -0.7;
    climber.facingY = -0.7;
    const highPlayer = makePlayer(-9.5, -8.5);
    highPlayer.elevation = 1;
    stepEco({ eco: stairEco, players: [highPlayer], ticks: 85 });
    expect(climber.elevation).toBe(1);
  });

  it("holds spider ambush in forest cover or nighttime while roaming normally in exposed daylight", () => {
    const coverEco = new WorldEcology(new ForestCoverCache(1337));
    const forestSpider = coverEco.spawnEntity({ kind: "spider", x: 10, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    forestSpider.facingX = 1;
    stepEco({ eco: coverEco, players: [makePlayer(15, 12)], ticks: 6 });
    expect(forestSpider.aiState).toBe("ambush");

    const dayOpenSpider = coverEco.spawnEntity({ kind: "spider", x: 20, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    dayOpenSpider.facingX = 1;
    stepEco({ eco: coverEco, players: [makePlayer(25, 12)], ticks: 6 });
    expect(dayOpenSpider.aiState).toBe("chase");

    const nightSpider = coverEco.spawnEntity({ kind: "spider", x: 20, y: 20, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    nightSpider.facingX = 1;
    stepEco({ eco: coverEco, players: [makePlayer(26.1, 20)], ticks: 6, dayPhase: 0.1 });
    expect(nightSpider.aiState).toBe("ambush");
  });

  it("spawns POI guards clear of tents/chests with open exits and routes pursuers around campfires and chests", () => {
    const cache = new WorldChunkCache(1337);
    const eco = new WorldEcology(cache);
    const poi = findChunkPoi(1337, 1, 0);
    expect(poi).not.toBeNull();
    if (!poi) return;
    eco.ensureAroundPlayers([makePlayer(poi.centerX, poi.centerY)]);
    const guards = eco.list.filter((e) => e.poiId === poi.id);
    expect(guards.length).toBeGreaterThanOrEqual(4);
    for (const g of guards) {
      for (const obs of cache.blockingObstaclesNear(g.x, g.y)) {
        expect(Math.hypot(g.x - obs.x, g.y - obs.y)).toBeGreaterThanOrEqual(obs.radius + 0.3);
      }
      const exitPath = findTilePath({ cache, startX: g.x, startY: g.y, goalX: poi.centerX, goalY: poi.centerY + poi.radiusY - 0.4, maxRadiusTiles: 12 });
      expect(exitPath.reachedGoal).toBe(true);
    }
    const runner = eco.spawnEntity({ kind: "goblin", x: poi.centerX, y: poi.centerY + 2.0, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    runner.facingY = -1;
    const target = makePlayer(poi.centerX, poi.centerY - 0.3);
    for (let i = 0; i < 45; i++) {
      eco.step({ dt: 0.05, timeSec: i * 0.05, dayPhase: 0.5, players: [target], events: [], onStrike: () => {} });
      expect(Math.hypot(runner.x - poi.centerX, runner.y - (poi.centerY + 0.8))).toBeGreaterThanOrEqual(0.72);
      expect(Math.hypot(runner.x - poi.chestX, runner.y - (poi.chestY - 0.14))).toBeGreaterThanOrEqual(0.7);
    }
  });
});
