import { describe, expect, it } from "vitest";
import { GroundKind, PropKind, WorldChunkCache, type ChunkProp } from "@dc2d/engine";
import { createCombatState, type CombatPlayerRef } from "../../combatActions.js";
import { createStarterInventory } from "../../playerInventory.js";
import { CREATURE_SPECS, type WildlifeKind } from "../creatureSpecs.js";
import { ScentTrail } from "./scentTrail.js";
import { WorldEcology } from "../worldEcology.js";
import { tryFollowAnimalScent } from "./searchTracking.js";

class OpenTestCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear(): readonly ChunkProp[] { return []; }
}

class RockTreeCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear(): readonly ChunkProp[] {
    return [{ id: "oak1", kind: PropKind.OakTree, x: 24, y: 12, variant: 0, elevation: 0, radius: 0.42, blocksMovement: true }];
  }
}

class RiverCampfireCache extends WorldChunkCache {
  override tileAt(wx: number) {
    const floorX = Math.floor(wx);
    if (floorX >= 20 && floorX <= 23) return { ground: GroundKind.DeepWater, elevation: 0, stairs: false };
    if (floorX >= 24 && floorX <= 25) return { ground: GroundKind.ShallowWater, elevation: 0, stairs: false };
    return { ground: GroundKind.Grass, elevation: 0, stairs: false };
  }
  override propsNear(): readonly ChunkProp[] {
    return [{ id: "fire1", kind: PropKind.Campfire, x: 30, y: 12, variant: 0, elevation: 0, radius: 0.35, blocksMovement: true }];
  }
}

class DenseWallCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear(): readonly ChunkProp[] {
    return [
      { id: "b1", kind: PropKind.Boulder, x: 24, y: 11, variant: 0, elevation: 0, radius: 0.6, blocksMovement: true },
      { id: "b2", kind: PropKind.Boulder, x: 24, y: 12, variant: 0, elevation: 0, radius: 0.6, blocksMovement: true },
      { id: "b3", kind: PropKind.Boulder, x: 24, y: 13, variant: 0, elevation: 0, radius: 0.6, blocksMovement: true },
    ];
  }
}

class NarrowRiverCache extends WorldChunkCache {
  override tileAt(wx: number) {
    const fx = Math.floor(wx);
    return { ground: fx >= 20 && fx <= 22 ? GroundKind.DeepWater : GroundKind.Grass, elevation: 0, stairs: false };
  }
  override propsNear(): readonly ChunkProp[] { return []; }
}

class WideLakeCache extends WorldChunkCache {
  override tileAt(wx: number) {
    const fx = Math.floor(wx);
    return { ground: fx >= 20 && fx <= 29 ? GroundKind.DeepWater : GroundKind.Grass, elevation: 0, stairs: false };
  }
  override propsNear(): readonly ChunkProp[] { return []; }
}

function makePlayer(x: number, y: number, id = "p1"): CombatPlayerRef & { moving: boolean; sprinting?: boolean } {
  return {
    id, x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, moving: false, sprinting: false,
    inventory: createStarterInventory(), combat: createCombatState(),
  };
}

function stepEco(opts: {
  readonly eco: WorldEcology; readonly p: CombatPlayerRef & { moving: boolean }; readonly steps: number; readonly dt?: number;
}): void {
  const dt = opts.dt ?? 0.05;
  for (let i = 0; i < opts.steps; i++) {
    opts.eco.step({ dt, timeSec: i * dt, dayPhase: 0.5, players: [opts.p], events: [], onStrike: () => {} });
  }
}

function recordScentTurnTrail(eco: WorldEcology, p: CombatPlayerRef & { moving: boolean }): void {
  p.moving = true;
  for (let i = 0; i < 16; i++) {
    if (i < 8) p.x += 0.5; else p.y += 0.5;
    stepEco({ eco, p, steps: 1, dt: 0.1 });
  }
}

describe("Wildlife structured search, sight, hearing, and animal scent tracking", () => {
  it("stops cleanly to scan at a thrown rock beside a tree without spinning in place", () => {
    const eco = new WorldEcology(new RockTreeCache(1337));
    const boar = eco.spawnEntity({ kind: "boar", x: 18, y: 12, homeRadius: 14, poiId: null, packId: null, packSlot: 0 });
    const farPlayer = makePlayer(60, 60);
    eco.emitNoise({ x: 24, y: 12, radius: 12 });
    expect(boar.aiState).toBe("investigate");
    expect(Math.hypot(boar.lastKnownX - 24, boar.lastKnownY - 12)).toBeGreaterThan(0.35);

    stepEco({ eco, p: farPlayer, steps: 55 });
    expect(boar.searchPhase).toBe("scan");
    const posAtScanStart = { x: boar.x, y: boar.y };
    const facings = new Set<number>();
    for (let i = 0; i < 8; i++) {
      stepEco({ eco, p: farPlayer, steps: 1, dt: 0.05 });
      expect(Math.hypot(boar.x - posAtScanStart.x, boar.y - posAtScanStart.y)).toBeLessThan(0.01);
      facings.add(Math.round(Math.atan2(boar.facingY, boar.facingX) * 10));
    }
    expect(facings.size).toBeGreaterThanOrEqual(2);
  });

  it("lets animals follow a 90-degree scent turn while blocking scent for non-animals", () => {
    const cache = new OpenTestCache(1337);
    const nonAnimals: readonly WildlifeKind[] = ["goblin", "orc", "skeleton", "golem", "spider", "slime"];
    const scent = new ScentTrail();
    scent.addCrumb({ x: 22, y: 12, actorId: "p1", strength: 1.0 });
    for (const kind of nonAnimals) {
      expect(CREATURE_SPECS[kind].sensory.scentRadius).toBe(0);
      const dummyEco = new WorldEcology(cache);
      const ent = dummyEco.spawnEntity({ kind, x: 21, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
      expect(tryFollowAnimalScent({ cache, e: ent, scent })).toBe(false);
    }

    const eco = new WorldEcology(cache);
    const boar = eco.spawnEntity({ kind: "boar", x: 15, y: 12, homeRadius: 24, poiId: null, packId: null, packSlot: 0 });
    const p = makePlayer(20, 12);
    recordScentTurnTrail(eco, p);
    boar.huntedTargetId = p.id; boar.huntedTargetKind = "player";
    boar.aiState = "investigate"; boar.investigateTimer = 14;
    boar.lastKnownX = 20; boar.lastKnownY = 12;
    p.x = 60; p.y = 60; p.moving = false;

    let sawSniffing = false;
    for (let i = 0; i < 90; i++) {
      stepEco({ eco, p, steps: 1, dt: 0.1 });
      if (eco.snapshots().entities.find((e) => e.id === boar.id)?.sniffing) sawSniffing = true;
    }
    expect(sawSniffing).toBe(true);
    expect(boar.y).toBeGreaterThan(14.0);
    expect(boar.lastScentSeq).toBeGreaterThan(1);
  });

  it("washes scent in deep water, dilutes shallow water, and masks body odor near campfires", () => {
    const cache = new RiverCampfireCache(1337);
    const scent = new ScentTrail();
    const deepP = makePlayer(21.5, 12, "p-deep"); deepP.moving = true; deepP.inDeepWater = true;
    scent.step(0.5);
    scent.samplePlayers([{ ...deepP, bleedTimer: 0 }], cache);
    expect(scent.findNextTrailCrumb({ x: 21.5, y: 12, elevation: 0, maxDist: 4, maxAgeSec: 22, actorId: "p-deep", minSeq: 0 })).toBeNull();

    const shallowP = makePlayer(24.5, 12, "p-shallow"); shallowP.moving = true; shallowP.inWater = true;
    scent.step(0.5);
    scent.samplePlayers([{ ...shallowP, bleedTimer: 0 }], cache);
    const shallowCrumb = scent.findNextTrailCrumb({ x: 24.0, y: 12, elevation: 0, maxDist: 4, maxAgeSec: 22, actorId: "p-shallow", minSeq: 0 });
    expect(shallowCrumb?.strength).toBeLessThan(0.5);
    expect(shallowCrumb?.decayRate).toBe(3.0);

    const fireP = makePlayer(30.5, 12, "p-fire");
    scent.samplePlayers([{ ...fireP, moving: false, bleedTimer: 0 }], cache);
    scent.step(1.3);
    scent.samplePlayers([{ ...fireP, moving: false, bleedTimer: 0 }], cache);
    const fireCrumb = scent.findNextTrailCrumb({ x: 30.0, y: 12, elevation: 0, maxDist: 4, maxAgeSec: 22, actorId: "p-fire", minSeq: 0 });
    expect(fireCrumb?.ambient).toBe(true);
    expect(fireCrumb?.strength).toBeLessThan(0.3);
  });

  it("lets hungry calm boars catch fresh scent while full boars ignore passive trails", () => {
    const cache = new OpenTestCache(1337);
    const eco = new WorldEcology(cache);
    const p = makePlayer(19, 13); p.moving = true;
    stepEco({ eco, p, steps: 2, dt: 0.1 });
    p.x = 60; p.y = 60; p.moving = false;
    const fullBoar = eco.spawnEntity({ kind: "boar", x: 18, y: 12, homeRadius: 12, poiId: null, packId: null, packSlot: 0 });
    const hungryBoar = eco.spawnEntity({ kind: "boar", x: 18, y: 14, homeRadius: 12, poiId: null, packId: null, packSlot: 1 });
    fullBoar.hunger = 0.2; hungryBoar.hunger = 0.65;
    stepEco({ eco, p, steps: 3, dt: 0.1 });
    expect(fullBoar.aiState).not.toBe("investigate");
    expect(hungryBoar.aiState).toBe("investigate");
    expect(eco.snapshots().entities.find((e) => e.id === hungryBoar.id)?.sniffing).toBe(true);
  });

  it("tracks sprinting behind cover via hearing, redirects search on pebble noise, and re-pops [!] on re-spot", () => {
    const eco = new WorldEcology(new DenseWallCache(1337));
    const boar = eco.spawnEntity({ kind: "boar", x: 21, y: 12, homeRadius: 18, poiId: null, packId: null, packSlot: 0 });
    const p = makePlayer(26, 12); p.sprinting = true; p.moving = true; p.noiseRadius = 6.5;
    boar.targetPlayerId = p.id; boar.targetKind = "player"; boar.huntedTargetId = p.id;
    boar.losGraceTimer = 0.35; boar.lastKnownX = 25; boar.lastKnownY = 12;
    stepEco({ eco, p, steps: 2, dt: 0.1 });
    expect(boar.lastKnownX).toBe(26);

    p.sprinting = false; p.moving = false; p.noiseRadius = 0.4;
    p.x = 60; p.y = 60;
    stepEco({ eco, p, steps: 6, dt: 0.1 });
    expect(boar.aiState).toBe("investigate");
    eco.emitNoise({ x: 17, y: 12, radius: 10 });
    expect(boar.lastKnownX).toBeCloseTo(17, 1);

    stepEco({ eco, p, steps: 12, dt: 0.1 });
    p.x = boar.x + 2.5; p.y = boar.y;
    boar.facingX = 1; boar.facingY = 0;
    stepEco({ eco, p, steps: 2, dt: 0.1 });
    expect(boar.targetPlayerId).toBe(p.id);
    expect(eco.snapshots().entities.find((e) => e.id === boar.id)?.spottedPop).toBe(true);
  });

  function recordRiverCrossingTrail(eco: WorldEcology, p: CombatPlayerRef & { moving: boolean }): void {
    p.moving = true;
    for (const wx of [17.5, 18.5, 19.3, 21.0, 23.6, 24.5]) {
      p.x = wx;
      p.inDeepWater = wx >= 20 && wx <= 22;
      stepEco({ eco, p, steps: 2, dt: 0.1 });
    }
    p.x = 60; p.y = 60; p.moving = false; p.inDeepWater = false;
  }

  it("adds a 15s cold-trail search and crosses narrow rivers to check the far bank", () => {
    const narrowEco = new WorldEcology(new NarrowRiverCache(1337));
    const p = makePlayer(17, 12);
    recordRiverCrossingTrail(narrowEco, p);
    const boar = narrowEco.spawnEntity({ kind: "boar", x: 16, y: 12, homeRadius: 24, poiId: null, packId: null, packSlot: 0 });
    boar.huntedTargetId = p.id; boar.huntedTargetKind = "player";
    boar.aiState = "investigate"; boar.investigateTimer = 6; boar.lastKnownX = 18; boar.lastKnownY = 12;

    let enteredColdSearch = false;
    let pickedFarBank = false;
    for (let i = 0; i < 85; i++) {
      stepEco({ eco: narrowEco, p, steps: 1, dt: 0.1 });
      if (boar.coldTrailSearchDone && boar.investigateTimer >= 13.5) enteredColdSearch = true;
      if (boar.searchPointX >= 23) pickedFarBank = true;
    }
    expect(enteredColdSearch).toBe(true);
    expect(pickedFarBank).toBe(true);
    expect(boar.x).toBeGreaterThan(22.5);

    const lakeEco = new WorldEcology(new WideLakeCache(1337));
    const lakeBoar = lakeEco.spawnEntity({ kind: "boar", x: 19, y: 12, homeRadius: 24, poiId: null, packId: null, packSlot: 0 });
    lakeBoar.aiState = "investigate"; lakeBoar.investigateTimer = 4; lakeBoar.lastScentSeq = 1;
    lakeBoar.searchPhase = "scan"; lakeBoar.searchPhaseTimer = 0.05; lakeBoar.searchAnchorAngle = 0;
    lakeBoar.lastKnownX = 19; lakeBoar.lastKnownY = 12;
    stepEco({ eco: lakeEco, p, steps: 2, dt: 0.1 });
    expect(lakeBoar.coldTrailSearchDone).toBe(true);
    expect(lakeBoar.investigateTimer).toBeGreaterThan(14.5);
    expect(lakeBoar.searchPointX).toBeLessThan(20);
  });
});
