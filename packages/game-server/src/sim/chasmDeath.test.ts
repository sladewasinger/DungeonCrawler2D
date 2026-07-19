import {
  CHASM_DEATH_Z,
  CHUNK_SIZE,
  LEVEL,
  PLAYER_MAX_HP,
  TILE,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type RawContent,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { resolveDeaths } from "./deaths.js";
import { stepPlayers } from "./players.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Sim test for the chasm = death design ruling (2026-07-19): rifts are
 * knockback death-pits, not inescapable holes. Split out from deaths.test.ts
 * — this exercises the stepPlayers -> killIfInChasm integration, not
 * resolveDeaths' own branching, which deaths.test.ts already covers.
 */

const EMPTY_CONTENT: RawContent = { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [] };

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
    stored: { slot: 0, name, stash: [] },
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
  };
}

function newSim(seed: string): SimState {
  const world = new World(hashString(seed), 1, LEVEL.Dungeon);
  const content = buildContentRegistry(EMPTY_CONTENT);
  return createSimState(world, content, new PlayerStore(null), 1, {});
}

/** Any Floor tile at or below chasm depth, scanning outward from the origin (mirrors world/generate/chasm.test.ts's findChasmChunk). */
function findChasmFloor(world: World): { x: number; y: number } | null {
  for (let cx = -24; cx <= 24; cx++) {
    for (let cy = -24; cy <= 24; cy++) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          if (world.tileAt(x, y) === TILE.Floor && world.heightAt(x, y) <= CHASM_DEATH_Z) return { x, y };
        }
      }
    }
  }
  return null;
}

describe("chasm = death (knockback-death-pit ruling)", () => {
  it("a player whose grounded z lands at/below chasm depth dies: full loot drop, respawn scheduled", () => {
    const sim = newSim("chasm-test-world");
    const spot = findChasmFloor(sim.world);
    expect(spot, "no chasm floor found in scan range").not.toBeNull();
    if (!spot) return;

    const a = makeSlot("A", spot.x + 0.5, spot.y + 0.5);
    // Simulate a knockback/fall that has JUST settled the body onto the
    // chasm floor, grounded — the same state stepBody leaves a body in
    // after landing, whatever pushed it there (fall, ledge shove, ramp
    // walk).
    a.entity.body.z = sim.world.heightAt(spot.x, spot.y);
    a.entity.body.grounded = true;
    sim.players.set(a.entity.id, a);

    stepPlayers(sim, []);

    expect(a.entity.hp).toBe(0);
    expect(a.forceDeath).toBe(true);

    resolveDeaths(sim);

    expect(a.forceDeath).toBe(false); // one-shot flag, consumed
    expect(a.downedAtTick).toBeNull(); // never entered the party-revive window
    expect(a.inventory).toHaveLength(0); // full loot drop
    expect(a.weapon).toBeNull();
    expect(a.respawnAtTick).toBe(sim.tickCount + 40); // RESPAWN_DELAY_TICKS, per spawn rules
    expect(sim.worldEvents.some((e) => e.ev.t === "death" && e.ev.id === a.entity.id)).toBe(true);
  });

  it("does not kill a player standing above chasm depth", () => {
    const sim = newSim("chasm-test-world");
    const a = makeSlot("A", 0.5, 0.5);
    const startingHp = a.entity.hp;
    a.entity.body.z = CHASM_DEATH_Z + 1; // well clear of the death band
    a.entity.body.grounded = true;
    sim.players.set(a.entity.id, a);

    stepPlayers(sim, []);

    expect(a.entity.hp).toBe(startingHp);
    expect(a.forceDeath).toBe(false);
  });
});
