import {
  LEVEL,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newBrain,
  newEntityId,
  type EnemyDef,
  type RawContent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { resolveDeaths } from "./deaths.js";
import { createSimState, type EnemySlot, type PlayerSlot, type SimState } from "./state.js";

/**
 * Unit tests for deaths.ts: enemy loot drops, the party-revive "downed"
 * window, bleed-out, and full-loot player death + respawn scheduling.
 * No dedicated reference/game-server test file exists for this module
 * (deaths/spawn are only exercised inside the monolithic v1 sim.test.ts,
 * which ports at integration) — cases below are written fresh against
 * the ported behavior in deaths.ts.
 */

const EMPTY_CONTENT: RawContent = {
  statuses: [],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

const slimeDef: EnemyDef = {
  id: "slime",
  name: "Slime",
  tags: ["organic"],
  hp: 12,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 },
  drops: [{ item: "rag", chance: 1 }],
  sprite: "slime",
};

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: 10,
    maxHp: 10,
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

function makeEnemySlot(x: number, y: number, hp: number): EnemySlot {
  const entity = makeEntity("enemy", createBody(x, y, 0), {
    id: newEntityId("e"),
    defId: slimeDef.id,
    name: slimeDef.name,
    hp,
    maxHp: slimeDef.hp,
    tags: new Set(slimeDef.tags),
  });
  return { entity, brain: newBrain(), def: slimeDef, animation: { state: "idle", ticksRemaining: 0 } };
}

describe("resolveDeaths", () => {
  let sim: SimState;

  beforeEach(() => {
    const world = new World(hashString("deaths-test"), 1, LEVEL.Dungeon);
    const content = buildContentRegistry(EMPTY_CONTENT);
    sim = createSimState(world, content, new PlayerStore(null), 1, {});
  });

  it("removes a dead enemy, emits a death event, and rolls its drops", () => {
    const enemy = makeEnemySlot(5, 5, 0);
    sim.enemies.set(enemy.entity.id, enemy);

    resolveDeaths(sim);

    expect(sim.enemies.has(enemy.entity.id)).toBe(false);
    expect(sim.worldEvents.some((e) => e.ev.t === "death" && e.ev.id === enemy.entity.id)).toBe(true);
    expect(sim.items.size).toBe(1);
  });

  it("leaves a living enemy alone", () => {
    const enemy = makeEnemySlot(5, 5, 6);
    sim.enemies.set(enemy.entity.id, enemy);

    resolveDeaths(sim);

    expect(sim.enemies.has(enemy.entity.id)).toBe(true);
  });

  it("downs (does not kill) a player with a conscious party member", () => {
    const a = makeSlot("A", 0, 0);
    const b = makeSlot("B", 1, 0);
    sim.players.set(a.entity.id, a);
    sim.players.set(b.entity.id, b);
    a.partyId = "p1";
    b.partyId = "p1";
    sim.parties.set("p1", { id: "p1", members: new Set([a.entity.id, b.entity.id]), roomSlot: null });
    a.entity.hp = 0;

    resolveDeaths(sim);

    expect(a.downedAtTick).toBe(sim.tickCount);
    expect(a.entity.hp).toBe(1);
    expect(a.entity.downedUntil).toBeDefined();
    expect(a.respawnAtTick).toBeNull();
    expect(a.outbox.some((e) => e.t === "toast")).toBe(true);
  });

  it("bleeds a downed player out to full death once the timer expires", () => {
    const a = makeSlot("A", 0, 0);
    sim.players.set(a.entity.id, a);
    a.downedAtTick = 0;
    a.entity.hp = 1;
    sim.tickCount = 30 * 20; // DOWNED_DURATION(30s) * TICK_RATE(20)

    resolveDeaths(sim);

    expect(a.entity.hp).toBe(0);
    expect(a.downedAtTick).toBeNull();
    // Same tick's death branch fires too: full loot drop + respawn scheduled.
    expect(a.inventory).toHaveLength(0);
    expect(a.respawnAtTick).toBe(sim.tickCount + 40);
  });

  it("kills outright (full loot drop, distant respawn) when solo or forced", () => {
    const a = makeSlot("A", 0, 0);
    sim.players.set(a.entity.id, a);
    a.entity.hp = 0;

    resolveDeaths(sim);

    expect(a.entity.hp).toBe(0);
    expect(a.inventory).toHaveLength(0);
    expect(a.weapon).toBeNull();
    expect(a.entity.statuses).toHaveLength(0);
    expect(a.downedAtTick).toBeNull();
    expect(a.respawnAtTick).toBe(sim.tickCount + 40);
    expect(sim.worldEvents.some((e) => e.ev.t === "death" && e.ev.id === a.entity.id)).toBe(true);
  });

  it("a menu-requested forceDeath bypasses the party downed state", () => {
    const a = makeSlot("A", 0, 0);
    const b = makeSlot("B", 1, 0);
    sim.players.set(a.entity.id, a);
    sim.players.set(b.entity.id, b);
    a.partyId = "p1";
    b.partyId = "p1";
    sim.parties.set("p1", { id: "p1", members: new Set([a.entity.id, b.entity.id]), roomSlot: null });
    a.entity.hp = 0;
    a.forceDeath = true;

    resolveDeaths(sim);

    expect(a.downedAtTick).toBeNull();
    expect(a.respawnAtTick).not.toBeNull();
    expect(a.forceDeath).toBe(false);
  });

  it("does nothing to an already-scheduled respawn", () => {
    const a = makeSlot("A", 0, 0);
    sim.players.set(a.entity.id, a);
    a.entity.hp = 0;
    a.respawnAtTick = sim.tickCount + 10;

    resolveDeaths(sim);

    expect(a.inventory).toHaveLength(1); // untouched — death already resolved once
  });
});
