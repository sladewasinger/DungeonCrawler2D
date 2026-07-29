import {
  LEVEL,
  PLAYER_MAX_HP,
  RESPAWN_DELAY_TICKS,
  TERRAIN,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { findWorldPoint } from "./chasmTestSupport.js";
import { resolveDeaths } from "./deaths.js";
import { stepPlayers } from "../players/players.js";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";

/**
 * Sim test for the chasm = death design ruling (2026-07-19): rifts are
 * knockback death-pits, not inescapable holes. Split out from deaths.test.ts
 * — this exercises the stepPlayers -> killIfInChasm integration, not
 * resolveDeaths' own branching, which deaths.test.ts already covers.
 */

const EMPTY_CONTENT: RawContent = { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [] };
const CHASM_WORLD_SEED_INPUT = "chasm-test-world";

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    tags: new Set(["player"]),
  });
  return {
    entity,
    clientId: `client-${name}`,
    stored: { slot: 0, name, stash: [], contacts: [] },
    resumeToken: `token-${name}`,
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [{ item: "rag", qty: 3 }],
    hotbar: [],
    weapon: "dagger",
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

function newSim(seed: string, voidTerrain = true): SimState {
  const world = new World(hashString(seed), 1, {
    level: LEVEL.Dungeon, features: { voidTerrain },
  });
  const content = buildContentRegistry(EMPTY_CONTENT);
  return createSimState({ world, content, store: new PlayerStore(null), rngSeed: 1, opts: {} });
}

/** Any explicit void tile, scanning outward from origin. */
function findChasmFloor(world: World): { x: number; y: number } | null {
  return findWorldPoint({ world, predicate: ({ terrain }) => terrain === TERRAIN.Void });
}

describe("chasm = death (knockback-death-pit ruling)", () => {
  it("a player grounded on explicit void dies: full loot drop, respawn scheduled", () => {
    const sim = newSim(CHASM_WORLD_SEED_INPUT);
    const spot = findChasmFloor(sim.world);
    expect(spot, "no chasm floor found in scan range").not.toBeNull();
    if (!spot) return;

    const a = makeSlot("A", spot.x + 0.5, spot.y + 0.5);
    // Simulate a knockback/teleport that leaves the body grounded in
    // authoritative void, regardless of the tile's numeric height.
    a.entity.body.z = sim.world.heightAt(spot.x, spot.y);
    a.entity.body.grounded = true;
    sim.players.set(a.entity.id, a);

    stepPlayers(sim, []);

    expect(a.entity.hp).toBe(0);
    expect(a.forceDeath).toBe(true);

    resolveDeaths(sim);

    expect(a.forceDeath).toBe(false); // one-shot flag, consumed
    expect(a.downedAtTick).toBeNull(); // never entered the universal downed window
    expect(a.inventory).toHaveLength(0); // full loot drop
    expect(a.weapon).toBeNull();
    expect(a.respawnAtTick).toBe(sim.tickCount + RESPAWN_DELAY_TICKS);
    expect(sim.worldEvents.some((e) => e.ev.t === "death" && e.ev.id === a.entity.id)).toBe(true);
  }, 15_000);

  it("keeps ordinary finite floor at z=-2 playable and nonlethal", () => {
    const sim = newSim(CHASM_WORLD_SEED_INPUT, false);
    const spot = findWorldPoint({
      world: sim.world,
      predicate: ({ height, terrain }) => height === -2 && terrain === TERRAIN.Floor,
    });
    expect(spot, "no finite z=-2 floor found in scan range").not.toBeNull();
    if (!spot) return;
    expect(sim.world.isWalkable(spot.x, spot.y)).toBe(true);
    expect(sim.world.terrainAt(spot.x, spot.y)).toBe(TERRAIN.Floor);

    const player = makeSlot("Finite", spot.x + 0.5, spot.y + 0.5);
    player.entity.body.z = sim.world.heightAt(spot.x, spot.y);
    player.entity.body.grounded = true;
    sim.players.set(player.entity.id, player);
    const startingHp = player.entity.hp;
    stepPlayers(sim, []);

    expect(player.entity.hp).toBe(startingHp);
    expect(player.forceDeath).toBe(false);
  }, 15_000);
});
