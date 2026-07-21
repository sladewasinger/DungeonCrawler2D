import { LEVEL, TILE, World, buildContentRegistry, createBody, hashString, makeEntity, newEntityId, type RawContent } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { addPlayer } from "./join.js";
import { reapAndRespawn } from "./players.js";
import { RADIUS_SPAWN_MIN_SPACING, findSpawn, resolveSpawnAnchor } from "./spawn.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Unit tests for spawn.ts's `spawnRadiusTiles` friend-playtest mode: split
 * out from spawn.test.ts (classic-scatter + clusterSpawns coverage) to keep
 * both files under the 200-line cap along a clean domain seam.
 */

const EMPTY_CONTENT: RawContent = {
  statuses: [],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

// Half-tile fuzz tolerance: spacing is scored between an integer candidate
// tile and existing players' tile-CENTER (+0.5, +0.5) body positions (see
// nearestPlayerDistance in spawn.ts), so the enforced spacing can read up
// to ~0.7 tiles under the nominal target — a pre-existing quirk shared with
// the classic-scatter path, not something this test suite re-litigates.
const OFFSET_FUZZ = 1;

function makeSlotAt(x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    hp: 10,
    maxHp: 10,
    tags: new Set(["player"]),
  });
  return {
    entity,
    clientId: "c",
    stored: { slot: 0, name: "p", stash: [], contacts: [] },
    resumeToken: "t",
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

function makeRadiusSim(radiusTiles: number, seedText = "spawn-radius-test", rngSeed = 42): SimState {
  const world = new World(hashString(seedText), 1, LEVEL.Dungeon);
  const content = buildContentRegistry(EMPTY_CONTENT);
  return createSimState(world, content, new PlayerStore(null), rngSeed, { spawnRadiusTiles: radiusTiles });
}

/** Tile-space distance from a returned (tile-center) spawn point to a tile-space anchor. */
function tileDistanceFromAnchor(spawn: { x: number; y: number }, anchor: { x: number; y: number }): number {
  return Math.hypot(Math.floor(spawn.x) - anchor.x, Math.floor(spawn.y) - anchor.y);
}

describe("findSpawn with spawnRadiusTiles", () => {
  let sim: SimState;
  const radiusTiles = 20;

  beforeEach(() => {
    sim = makeRadiusSim(radiusTiles);
  });

  it("lands on walkable floor within spawnRadiusTiles of the anchor for several sequential joins", () => {
    const anchor = resolveSpawnAnchor(sim);
    for (let i = 0; i < 6; i++) {
      const spawn = findSpawn(sim);
      const tileX = Math.floor(spawn.x);
      const tileY = Math.floor(spawn.y);
      expect(sim.world.isWalkable(tileX, tileY)).toBe(true);
      expect(sim.world.tileAt(tileX, tileY)).not.toBe(TILE.Wall);
      expect(tileDistanceFromAnchor(spawn, anchor)).toBeLessThanOrEqual(radiusTiles);
      sim.players.set(`p${i}`, makeSlotAt(spawn.x, spawn.y));
    }
  });

  it("keeps concurrent players at least ~RADIUS_SPAWN_MIN_SPACING apart when the region isn't crowded", () => {
    const spawns: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 5; i++) {
      const spawn = findSpawn(sim);
      spawns.push(spawn);
      sim.players.set(`p${i}`, makeSlotAt(spawn.x, spawn.y));
    }
    for (let i = 0; i < spawns.length; i++) {
      for (let j = i + 1; j < spawns.length; j++) {
        const distance = Math.hypot(spawns[i]!.x - spawns[j]!.x, spawns[i]!.y - spawns[j]!.y);
        expect(distance).toBeGreaterThanOrEqual(RADIUS_SPAWN_MIN_SPACING - OFFSET_FUZZ);
      }
    }
  });

  it("falls back to relaxed spacing (never crashes, still valid) when the region is crowded", () => {
    const anchor = resolveSpawnAnchor(sim);
    // Every existing player sits exactly on the anchor, so no candidate can
    // ever clear RADIUS_SPAWN_MIN_SPACING — forces every relaxation step.
    for (let i = 0; i < 20; i++) {
      sim.players.set(`crowd${i}`, makeSlotAt(anchor.x + 0.5, anchor.y + 0.5));
    }

    const spawn = findSpawn(sim);
    const tileX = Math.floor(spawn.x);
    const tileY = Math.floor(spawn.y);
    expect(Number.isFinite(spawn.x)).toBe(true);
    expect(Number.isFinite(spawn.y)).toBe(true);
    expect(sim.world.isWalkable(tileX, tileY)).toBe(true);
    expect(tileDistanceFromAnchor(spawn, anchor)).toBeLessThanOrEqual(radiusTiles);
  });

  it("respawn after death lands within spawnRadiusTiles of the anchor too", () => {
    const anchor = resolveSpawnAnchor(sim);
    const join = addPlayer(sim, "Respawner", "client-respawn");
    const slot = sim.players.get(join.playerId);
    expect(slot).toBeDefined();
    slot!.respawnAtTick = sim.tickCount;

    reapAndRespawn(sim);

    const respawned = { x: slot!.entity.body.x, y: slot!.entity.body.y };
    expect(tileDistanceFromAnchor(respawned, anchor)).toBeLessThanOrEqual(radiusTiles);
  });
});

describe("resolveSpawnAnchor", () => {
  it("is identical for the same worldSeed+floor regardless of rngSeed, join order, or player count", () => {
    // spawnRadiusTiles itself is irrelevant here — the anchor never reads it.
    const simA = makeRadiusSim(50, "spawn-radius-anchor-test", 1);

    const simB = makeRadiusSim(50, "spawn-radius-anchor-test", 999);
    simB.rng.next();
    simB.rng.next();
    simB.players.set("noise", makeSlotAt(5, 5));

    expect(resolveSpawnAnchor(simA)).toEqual(resolveSpawnAnchor(simB));
  });

  it("resolves to a walkable, non-wall floor tile", () => {
    const sim = makeRadiusSim(50);
    const anchor = resolveSpawnAnchor(sim);
    expect(sim.world.isWalkable(anchor.x, anchor.y)).toBe(true);
    expect(sim.world.tileAt(anchor.x, anchor.y)).not.toBe(TILE.Wall);
  });
});
