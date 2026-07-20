import {
  LEVEL,
  MIN_SPAWN_DIST,
  TILE,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { findSpawn, findWalkableNear, newToken } from "./spawn.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Unit tests for spawn.ts against the new BSP generator: no dedicated
 * reference/game-server test file covers spawn.ts (only exercised inside
 * the monolithic v1 sim.test.ts, which ports at integration).
 */

const EMPTY_CONTENT: RawContent = {
  statuses: [],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

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
    lastFistbumpOfferAtTick: -Infinity, pendingTransfer: null,
  };
}

describe("findSpawn", () => {
  let sim: SimState;

  beforeEach(() => {
    const world = new World(hashString("spawn-test"), 1, LEVEL.Dungeon);
    const content = buildContentRegistry(EMPTY_CONTENT);
    sim = createSimState(world, content, new PlayerStore(null), 42, {});
  });

  it("lands on a walkable, non-wall room/corridor tile at the tile's ground height", () => {
    const spawn = findSpawn(sim);
    const tileX = Math.floor(spawn.x);
    const tileY = Math.floor(spawn.y);
    expect(sim.world.isWalkable(tileX, tileY)).toBe(true);
    expect(sim.world.tileAt(tileX, tileY)).not.toBe(TILE.Wall);
    expect(spawn.z).toBe(sim.world.groundAt(spawn.x, spawn.y));
  });

  it("prefers a candidate at least MIN_SPAWN_DIST from every existing player", () => {
    sim.players.set("existing", makeSlotAt(0, 0));

    const spawn = findSpawn(sim);
    const distance = Math.hypot(spawn.x, spawn.y);
    expect(distance).toBeGreaterThanOrEqual(MIN_SPAWN_DIST);
  });

  it("still returns a valid tile when no candidate clears MIN_SPAWN_DIST", () => {
    // A player parked on every plausible candidate chunk center forces the
    // 40-attempt search to fall back to its best (farthest) candidate
    // instead of finding one that clears MIN_SPAWN_DIST.
    for (let i = 0; i < 50; i++) {
      sim.players.set(`p${i}`, makeSlotAt((sim.rng.next() - 0.5) * 1024, (sim.rng.next() - 0.5) * 1024));
    }

    const spawn = findSpawn(sim);
    expect(Number.isFinite(spawn.x)).toBe(true);
    expect(Number.isFinite(spawn.y)).toBe(true);
    expect(sim.world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});

describe("findWalkableNear", () => {
  it("returns the queried tile itself when it is already walkable floor", () => {
    const world = new World(hashString("spawn-test"), 1, LEVEL.Dungeon);
    const content = buildContentRegistry(EMPTY_CONTENT);
    const sim = createSimState(world, content, new PlayerStore(null), 1, {});
    const seed = findSpawn(sim);

    const found = findWalkableNear(sim, Math.floor(seed.x), Math.floor(seed.y));
    expect(found).toEqual({ x: Math.floor(seed.x), y: Math.floor(seed.y) });
  });
});

describe("newToken", () => {
  it("produces distinct non-empty tokens on successive calls", () => {
    const world = new World(hashString("spawn-test"), 1, LEVEL.Dungeon);
    const content = buildContentRegistry(EMPTY_CONTENT);
    const sim = createSimState(world, content, new PlayerStore(null), 7, {});

    const a = newToken(sim);
    const b = newToken(sim);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
