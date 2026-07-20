import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  LEVEL,
  World,
  bossArenaGatePosition,
  bossArenaSpawnAnchor,
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  newEntityId,
  type ContentRegistry,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { createSimState, type PlayerSlot, type SimState } from "../state.js";
import { handleBossDeath, initBossFloor, stepBoss } from "./boss.js";
import { BOSS_RESPAWN_TICKS, BOSS_XP_BURST, WARDEN_DEF_ID } from "./constants.js";

/**
 * Direct SimState-level tests for the Warden lifecycle (Epic 7.14):
 * spawn-on-creation, gate seal/unseal at the arena's real generator-
 * placed gate cell, the death -> XP burst -> respawn cycle. Drives
 * floors/boss.ts functions directly (like enemies.test.ts drives
 * enemies/index.ts) rather than through GameSim, since this subsystem's
 * inputs/outputs are all plain SimState mutations.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});
const SEED = hashString("boss-test-world");

function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"),
    name,
    hp: 30,
    maxHp: 30,
    tags: new Set(["player"]),
  });
  return {
    entity,
    clientId: `client-${name}`,
    stored: { slot: 0, name, stash: [], contacts: [], xp: 0, level: 1 },
    resumeToken: `token-${name}`,
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
    lastFistbumpOfferAtTick: -Infinity,
    pendingTransfer: null,
  };
}

function bossFloorSim(): SimState {
  const world = new World(SEED, 5, LEVEL.Dungeon);
  return createSimState(world, content, new PlayerStore(null), 1, {});
}

describe("floors/boss", () => {
  let sim: SimState;

  beforeEach(() => {
    sim = bossFloorSim();
  });

  it("spawns the Warden at floor-5 sim creation, nowhere else", () => {
    initBossFloor(sim);
    const bosses = [...sim.enemies.values()].filter((e) => e.def.id === WARDEN_DEF_ID);
    expect(bosses).toHaveLength(1);

    const floor3 = createSimState(new World(SEED, 3, LEVEL.Dungeon), content, new PlayerStore(null), 1, {});
    initBossFloor(floor3);
    expect(floor3.enemies.size).toBe(0);
  });

  it("gate stays open with nobody inside; seals once a player enters the arena", () => {
    initBossFloor(sim);
    const anchor = bossArenaSpawnAnchor(sim.world)!;
    expect(anchor).toBeTruthy();
    const slot = makeSlot("A", anchor.x + 100, anchor.y + 100); // well outside
    sim.players.set(slot.entity.id, slot);

    stepBoss(sim);
    expect(sim.bossGateSealed).toBe(false);

    slot.entity.body.x = anchor.x;
    slot.entity.body.y = anchor.y;
    stepBoss(sim);
    expect(sim.bossGateSealed).toBe(true);
  });

  it("while sealed, the gate cell pushes an outsider back out and an insider back in", () => {
    initBossFloor(sim);
    const anchor = bossArenaSpawnAnchor(sim.world)!;
    const gate = bossArenaGatePosition(sim.world)!;
    const insider = makeSlot("In", anchor.x, anchor.y);
    const outsider = makeSlot("Out", gate.x, gate.y + 5); // outside, approaching the gate
    sim.players.set(insider.entity.id, insider);
    sim.players.set(outsider.entity.id, outsider);
    stepBoss(sim); // arms the seal (insider is inside)
    expect(sim.bossGateSealed).toBe(true);

    // Insider tries to walk out through the gate cell.
    insider.entity.body.x = gate.x;
    insider.entity.body.y = gate.y;
    // Outsider tries to walk in through the gate cell.
    outsider.entity.body.x = gate.x;
    outsider.entity.body.y = gate.y;
    stepBoss(sim);

    expect(insider.entity.body.y).toBeLessThan(gate.y); // pushed back inside
    expect(outsider.entity.body.y).toBeGreaterThan(gate.y); // pushed back outside
  });

  it("unseals when the sole occupant leaves the sim entirely (disconnect reap / death->floor1 transfer) while the boss lives", () => {
    initBossFloor(sim);
    const anchor = bossArenaSpawnAnchor(sim.world)!;
    const gate = bossArenaGatePosition(sim.world)!;
    const solo = makeSlot("Solo", anchor.x, anchor.y);
    sim.players.set(solo.entity.id, solo);
    stepBoss(sim); // arms the seal
    expect(sim.bossGateSealed).toBe(true);

    // Solo occupant is gone from the sim outright — reapAndRespawn's
    // disconnect-grace deletion and floors/transfer.ts's death->floor-1
    // drain both do exactly this: sim.players.delete(id).
    sim.players.delete(solo.entity.id);

    const newcomer = makeSlot("New", gate.x, gate.y + 5);
    sim.players.set(newcomer.entity.id, newcomer);
    newcomer.entity.body.x = gate.x;
    newcomer.entity.body.y = gate.y;
    stepBoss(sim);

    expect(sim.bossGateSealed).toBe(false);
    expect(sim.bossArenaOccupants.size).toBe(0);
    // Gate no longer clamps: the newcomer wasn't shoved back outside.
    expect(newcomer.entity.body.y).toBe(gate.y);
  });

  it("boss death: XP burst only to occupants inside the arena, gate opens, respawn timer set", () => {
    initBossFloor(sim);
    const anchor = bossArenaSpawnAnchor(sim.world)!;
    const inside = makeSlot("In", anchor.x, anchor.y);
    const outside = makeSlot("Out", anchor.x + 500, anchor.y + 500);
    sim.players.set(inside.entity.id, inside);
    sim.players.set(outside.entity.id, outside);
    sim.bossGateSealed = true;

    handleBossDeath(sim);

    expect(inside.stored.xp).toBe(BOSS_XP_BURST);
    expect(outside.stored.xp).toBe(0);
    expect(sim.bossGateSealed).toBe(false);
    expect(sim.bossRespawnAtTick).toBe(sim.tickCount + BOSS_RESPAWN_TICKS);
  });

  it("respawns the Warden once the respawn timer elapses", () => {
    initBossFloor(sim);
    const [firstId] = [...sim.enemies.keys()];
    handleBossDeath(sim);
    sim.enemies.delete(firstId!); // resolveDeaths would have removed the corpse

    sim.tickCount = sim.bossRespawnAtTick! - 1;
    stepBoss(sim);
    expect(sim.enemies.size).toBe(0);

    sim.tickCount = sim.bossRespawnAtTick!;
    stepBoss(sim);
    expect([...sim.enemies.values()].some((e) => e.def.id === WARDEN_DEF_ID)).toBe(true);
    expect(sim.bossRespawnAtTick).toBeNull();
  });
});
