import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LEVEL,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newBrain,
  newEntityId,
  xpForLevel,
  type EnemyDef,
  type RawContent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { announceKill, announceLevelUp } from "./announcer/index.js";
import { awardKillXp, levelForXp } from "./xp.js";
import { createSimState, type EnemySlot, type PlayerSlot, type SimState } from "./state.js";

/**
 * Unit tests for sim/xp.ts: the level curve inversion and the kill-XP
 * award hook (attribution, persistence, level-up chat line). The GameSim
 * integration path (real melee kill -> snapshot self.xp) lives in
 * sim/integration/xp.test.ts.
 */

const EMPTY_CONTENT: RawContent = {
  statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [],
};

const slimeDef: EnemyDef = {
  id: "slime", name: "Slime", tags: ["organic"], hp: 12, speed: 3, aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 }, drops: [], sprite: "slime", xp: 5,
  epithet: "dissolved by a slime. A slime.",
};

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"), name, hp: 10, maxHp: 10, tags: new Set(["player"]),
  });
  return {
    entity, clientId: `client-${name}`, stored: { slot: 0, name, stash: [], contacts: [], xp: 0, level: 1 },
    resumeToken: `token-${name}`, lastSeq: -1, pendingInputs: [], pendingActions: [], connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER, known: new Set(), inventory: [], hotbar: [], weapon: null,
    outbox: [], returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: true,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false, forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

function makeEnemySlot(x: number, y: number, def: EnemyDef): EnemySlot {
  const entity = makeEntity("enemy", createBody(x, y, 0), {
    id: newEntityId("e"), defId: def.id, name: def.name, hp: 0, maxHp: def.hp, tags: new Set(def.tags),
  });
  return { entity, brain: newBrain(), def, animation: { state: "idle", ticksRemaining: 0 } };
}

describe("levelForXp / xpForLevel", () => {
  it("level 1 costs 0 xp and stays level 1 until the level-2 threshold", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2) - 1)).toBe(1);
  });

  it("crosses to the next level exactly at its cumulative threshold", () => {
    for (const level of [2, 3, 4, 7, 20]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });

  it("has no cap — scales correctly far past early levels", () => {
    expect(levelForXp(xpForLevel(500))).toBe(500);
  });
});

describe("awardKillXp", () => {
  let sim: SimState;

  beforeEach(() => {
    const world = new World(hashString("xp-test"), 1, LEVEL.Dungeon);
    const content = buildContentRegistry(EMPTY_CONTENT);
    sim = createSimState(world, content, new PlayerStore(null), 1, {});
    sim.tickCount = 100;
  });

  it("awards the enemy's xp to the player who swung this tick in range", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(5);
    expect(a.stored.level).toBe(1); // below the level-2 threshold (100)
  });

  it("does not award a player who did not swing this exact tick", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount - 1; // swung last tick, not this one
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(0);
  });

  it("does not award a player who swung this tick but was out of range", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(50, 50, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(0);
  });

  it("attributes to the nearer of two same-tick swingers and leaves the other untouched", () => {
    const near = makeSlot("Near", 5.2, 5);
    near.attackStartedAtTick = sim.tickCount;
    const far = makeSlot("Far", 6, 5);
    far.attackStartedAtTick = sim.tickCount;
    sim.players.set(near.entity.id, near);
    sim.players.set(far.entity.id, far);
    const enemy = makeEnemySlot(5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(near.stored.xp).toBe(5);
    expect(far.stored.xp).toBe(0); // no award for the other player's non-kill
  });

  it("awards nothing for an enemy def without an xp value", () => {
    const noXpDef: EnemyDef = { ...slimeDef, xp: undefined };
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, noXpDef);

    awardKillXp(sim, enemy);

    expect(a.stored.xp).toBe(0);
  });

  it("broadcasts an announcer level-up line when a kill crosses a level threshold", () => {
    const bigXpDef: EnemyDef = { ...slimeDef, xp: xpForLevel(2) };
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, bigXpDef);

    awardKillXp(sim, enemy);

    expect(a.stored.level).toBe(2);
    // Broadcast, not private: every connected slot (here, just the killer)
    // gets the exact deterministic line the announcer picks for this tick.
    expect(a.outbox).toContainEqual(announceLevelUp(sim.tickCount, a.entity.id, "A", 2));
  });

  it("sends the killer a private personal kill line naming the enemy's epithet", () => {
    const a = makeSlot("A", 5, 5);
    a.attackStartedAtTick = sim.tickCount;
    sim.players.set(a.entity.id, a);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    expect(a.outbox).toContainEqual(announceKill(sim.tickCount, a.entity.id, slimeDef));
    const killLine = a.outbox.find(
      (ev) => ev.t === "chat" && ev.text.startsWith("Dissolved a slime"),
    );
    expect(killLine).toBeDefined();
  });

  it("delivers the personal kill line only to the killer, never broadcasts it", () => {
    const killer = makeSlot("Killer", 5, 5);
    killer.attackStartedAtTick = sim.tickCount;
    const bystander = makeSlot("Bystander", 5, 5);
    sim.players.set(killer.entity.id, killer);
    sim.players.set(bystander.entity.id, bystander);
    const enemy = makeEnemySlot(5.5, 5, slimeDef);

    awardKillXp(sim, enemy);

    const bystanderKillLine = bystander.outbox.find(
      (ev) => ev.t === "chat" && ev.text.startsWith("Dissolved a slime"),
    );
    expect(bystanderKillLine).toBeUndefined();
  });

  it("persists the award via PlayerStore (survives a fresh load from the same file)", () => {
    const file = join(tmpdir(), `dc2d-xp-store-${Date.now()}-${Math.random()}.json`);
    try {
      const world = new World(hashString("xp-persist-test"), 1, LEVEL.Dungeon);
      const content = buildContentRegistry(EMPTY_CONTENT);
      const store = new PlayerStore(file);
      const localSim = createSimState(world, content, store, 1, {});
      localSim.tickCount = sim.tickCount;
      const a = makeSlot("A", 5, 5);
      a.stored = store.get(a.clientId, "A"); // the actual persisted record, not a throwaway literal
      a.attackStartedAtTick = localSim.tickCount;
      localSim.players.set(a.entity.id, a);
      const enemy = makeEnemySlot(5.5, 5, slimeDef);

      awardKillXp(localSim, enemy);
      store.flush();

      const reloaded = new PlayerStore(file);
      const record = reloaded.get(a.clientId, "A");
      expect(record.xp).toBe(5);
      expect(record.level).toBe(1);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
