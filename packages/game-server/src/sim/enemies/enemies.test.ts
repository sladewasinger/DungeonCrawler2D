import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { buildContentRegistry, CHASM_DEATH_Z, hashString, LEVEL, makeEntity, World, createBody, type ContentRegistry } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";
import { PlayerStore } from "../../store.js";
import { populateTestZoneChunk } from "../core/testzone.js";
import { activateChunksNearPlayers } from "./index.js";

/** Headless tests for the enemy subsystem: population placement and per-tick AI. */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});
const SEED = hashString("enemies-test-world");

/** Scan outward from (0,0) for a walkable, non-sanctuary tile —
 * robust to worldgen changes, unlike hardcoded coordinates. */
function findOpenFloor(sim: SimState): { x: number; y: number } {
  for (let radius = 0; radius < 64; radius++) {
    const floor = perimeterTiles(radius).find((tile) => isOpenFloor(sim, tile));
    if (floor) return { x: floor.x + 0.5, y: floor.y + 0.5 };
  }
  throw new Error("no open floor found near (200, 200)");
}

function perimeterTiles(radius: number): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  for (let offset = -radius; offset <= radius; offset++) {
    tiles.push({ x: 200 + offset, y: 200 - radius }, { x: 200 + offset, y: 200 + radius });
  }
  for (let offset = 1 - radius; offset < radius; offset++) {
    tiles.push({ x: 200 - radius, y: 200 + offset }, { x: 200 + radius, y: 200 + offset });
  }
  return tiles;
}

function isOpenFloor(sim: SimState, tile: { x: number; y: number }): boolean {
  return sim.world.isWalkable(tile.x, tile.y) && !sim.world.isSanctuary(tile.x, tile.y);
}

interface PlayerSlotFixture {
  x: number;
  y: number;
  sim: SimState;
  id?: string;
}

function makePlayerSlot(fixture: PlayerSlotFixture): PlayerSlot {
  const { x, y, sim, id = "p1" } = fixture;
  const entity = makeEntity("player", createBody(x, y, sim.world.groundAt(x, y)), {
    id,
    hp: 30,
    maxHp: 30,
    baseSpeed: 8,
  });
  return {
    entity,
    clientId: `c-${id}`,
    stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok",
    lastSeq: 0,
    pendingInputs: [], pendingActions: [],
    connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: [],
    weapon: null, outbox: [], returnStack: [],
    partyId: null, respawnAtTick: null, needsFullAreas: true,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -1000,
    god: false, forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

describe("enemy population", () => {
  let sim: SimState;

  beforeEach(() => {
    const world = new World(SEED, 1, LEVEL.Dungeon);
    sim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: 42, opts: {} });
  });

  it("only spawns enemies on walkable, non-sanctuary, non-wall tiles", () => {
    const spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot({ x: spot.x, y: spot.y, sim }));

    activateChunksNearPlayers(sim);

    expect(sim.enemies.size).toBeGreaterThan(0);
    for (const enemy of sim.enemies.values()) {
      const tx = Math.floor(enemy.entity.body.x);
      const ty = Math.floor(enemy.entity.body.y);
      expect(sim.world.isWalkable(tx, ty)).toBe(true);
      expect(sim.world.isSanctuary(tx, ty)).toBe(false);
      expect(sim.world.heightAt(tx, ty)).toBeGreaterThan(CHASM_DEATH_Z);
    }
  });

  it("does not re-populate an already-activated chunk", () => {
    const spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot({ x: spot.x, y: spot.y, sim }));

    activateChunksNearPlayers(sim);
    const first = sim.enemies.size;
    activateChunksNearPlayers(sim);

    expect(sim.enemies.size).toBe(first);
  });

  it("test-fixture chunks place the canonical roster instead of random spawns", () => {
    const world = new World(SEED, 1, LEVEL.Sandbox);
    const fixtureSim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: 42, opts: {
      testFixtures: true,
    } });
    const placed = populateTestZoneChunk(fixtureSim, 0, 0);
    expect(placed).toBe(true);
    expect(fixtureSim.enemies.size).toBeGreaterThan(0);
    expect(populateTestZoneChunk(fixtureSim, 5, 5)).toBe(false);
  });
});
