import { areasData, enemiesData, itemsData, recipesData, rulesData, statusesData } from "@dc2d/content";
import { buildContentRegistry, createBody, hashString, LEVEL, makeEntity, World, type EffectEvent } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { resolveDeaths } from "../../combat/deaths.js";
import { spawnEnemy } from "../../core/helpers.js";
import { createSimState, type PlayerSlot, type SimState } from "../../state/state.js";
import { stepEnemies } from "../index.js";

const content = buildContentRegistry({
  statuses: [...statusesData], rules: [...rulesData], areas: [...areasData],
  items: [...itemsData], enemies: [...enemiesData], recipes: [...recipesData],
});

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
  return tiles;
}

function isOpenFloor(sim: SimState, tile: { x: number; y: number }): boolean {
  return sim.world.isWalkable(tile.x, tile.y) && !sim.world.isSanctuary(tile.x, tile.y);
}

function makePlayerSlot(sim: SimState, spot: { x: number; y: number }, id = "p1"): PlayerSlot {
  const entity = makeEntity("player", createBody(spot.x, spot.y, sim.world.groundAt(spot.x, spot.y)), {
    id, hp: 30, maxHp: 30, baseSpeed: 8,
  });
  return {
    entity, clientId: `c-${id}`, stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok", lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: [], weapon: null, outbox: [], returnStack: [], partyId: null,
    respawnAtTick: null, needsFullAreas: true, downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: -1000,
    god: false, forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

describe("enemy AI", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createSimState({ world: new World(hashString("enemies-test-world"), 1, LEVEL.Dungeon), content, store: new PlayerStore(null), rngSeed: 42, opts: {} });
    spot = findOpenFloor(sim);
    sim.players.set("p1", makePlayerSlot(sim, spot));
  });

  it("freezes enemies with no player within ENEMY_ACTIVE_RADIUS", () => {
    const enemy = spawnEnemy(sim, { defId: "slime", x: spot.x + 1000, y: spot.y + 1000 });
    const before = { x: enemy.body.x, y: enemy.body.y };
    stepEnemies(sim, []);
    expect(enemy.body.x).toBe(before.x);
    expect(enemy.body.y).toBe(before.y);
  });

  it("strikes an adjacent player once in melee range", () => {
    const enemy = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    const player = requirePlayer(sim, "p1").entity;
    const startHp = player.hp;
    stepEnemies(sim, []);
    expect(player.hp).toBeLessThan(startHp);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("fully blocks melee damage, status effects, and knockback with a weapon", () => {
    const enemy = spawnEnemy(sim, { defId: "skeleton", x: spot.x + 0.8, y: spot.y });
    const slot = requirePlayer(sim, "p1");
    slot.weapon = "sword";
    slot.blocking = true;
    const startHp = slot.entity.hp;
    const startBody = { ...slot.entity.body };
    const effects: EffectEvent[] = [];
    stepEnemies(sim, effects);
    expect(slot.entity.hp).toBe(startHp);
    expect(slot.entity.statuses).toEqual([]);
    expect(slot.entity.body.kx).toBe(startBody.kx);
    expect(slot.entity.body.ky).toBe(startBody.ky);
    expect(effects).toEqual([]);
    expect(sim.enemies.get(enemy.id)?.animation.state).toBe("attack");
  });

  it("a spitter winds up, then launches a projectile", () => {
    const entity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing spitter fixture");
    expect(enemy.animation.state).toBe("windup");
    for (let count = 0; count < 5; count++) stepEnemies(sim, []);
    expect(enemy.animation.state).toBe("spit");
    expect(sim.projectiles.size).toBe(1);
  });

  it("cancels a windup and resumes wandering when its target is downed", () => {
    const entity = spawnEnemy(sim, { defId: "spitter", x: spot.x + 4, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const player = sim.players.get("p1");
    if (!enemy || !player) throw new Error("missing target lifecycle fixture");
    expect(enemy.animation.state).toBe("windup");
    player.entity.hp = 0;
    resolveDeaths(sim);
    expect(enemy.brain.targetId).toBeNull();
    enemy.brain.wanderDir = { moveX: 1, moveY: 0, jump: false };
    enemy.brain.wanderLeft = 1;
    stepEnemies(sim, []);
    expect(enemy.brain.wanderLeft).toBeLessThan(1);
  });

  it("abandons a dead target and reacquires the nearest living player", () => {
    const living = makePlayerSlot(sim, { x: spot.x + 3, y: spot.y }, "p2");
    sim.players.set(living.entity.id, living);
    const entity = spawnEnemy(sim, { defId: "slime", x: spot.x + 1, y: spot.y });
    stepEnemies(sim, []);
    const enemy = sim.enemies.get(entity.id);
    const dead = sim.players.get("p1");
    if (!enemy || !dead) throw new Error("missing reacquisition fixture");
    expect(enemy.brain.targetId).toBe(dead.entity.id);
    dead.entity.hp = 0;
    stepEnemies(sim, []);
    expect(enemy.brain.targetId).toBe(living.entity.id);
  });
});

function requirePlayer(sim: SimState, id: string): PlayerSlot {
  const player = sim.players.get(id);
  if (!player) throw new Error(`missing player fixture: ${id}`);
  return player;
}
