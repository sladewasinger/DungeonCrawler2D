import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  CHASM_DEATH_Z,
  LEVEL,
  PLAYER_MAX_HP,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  type ContentRegistry,
  type EffectEvent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { stepEnemies } from "./enemies/index.js";
import { effectTargetFor, spawnEnemy } from "./helpers.js";
import { addPlayer } from "./join.js";
import { handleInput, queueAction, stepPlayers } from "./players.js";
import { processActions } from "./actions/index.js";
import { isSpawnProtected } from "./spawnSafety.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Spawn-safety GRACE window (panel round 3b blocker #1): for
 * SPAWN_GRACE_TICKS after a fresh handoff the player takes no damage,
 * catches no debuffs, and is invisible to enemy aggro — ending early
 * the moment they move or attack. Clearance coverage lives in
 * spawnSafety.test.ts.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

/** Nearest walkable, non-sanctuary, non-chasm tile CENTER near (ax, ay). */
function openFloorNear(sim: SimState, ax: number, ay: number): { x: number; y: number } {
  for (let radius = 0; radius < 64; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = ax + dx;
        const y = ay + dy;
        if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) continue;
        if (sim.world.heightAt(x, y) <= CHASM_DEATH_Z) continue;
        return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  throw new Error(`no open floor near (${ax}, ${ay})`);
}

describe("spawn grace", () => {
  let sim: SimState;
  let playerId: string;
  let slot: PlayerSlot;

  beforeEach(() => {
    const world = new World(hashString("spawn-grace-test"), 1, LEVEL.Dungeon);
    sim = createSimState(world, content, new PlayerStore(null), 5, { spawnRadiusTiles: 12 });
    playerId = addPlayer(sim, "Newborn", "client-g").playerId;
    slot = sim.players.get(playerId)!;
    // Damage paths sanctuary-suppress independently of grace — park the
    // body on known NON-sanctuary floor so every assertion isolates grace.
    const spot = openFloorNear(sim, 200, 200);
    slot.entity.body = createBody(spot.x, spot.y, sim.world.groundAt(spot.x, spot.y));
  });

  it("blocks damage and debuffs while active, then expires by the clock", () => {
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(true);
    expect(effectTargetFor(sim, slot.entity)).toEqual({ invulnerable: true });

    const events: EffectEvent[] = [];
    const target = effectTargetFor(sim, slot.entity);
    expect(sim.effects.modifyHealth(slot.entity, -5, events, { sourceTags: ["physical"] }, target)).toBe(0);
    expect(sim.effects.applyStatus(slot.entity, "poisoned", events, target)).toBe(false);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
    expect(events).toHaveLength(0);

    // SPAWN_GRACE_TICKS later the same hit connects: 2s is a mercy, not armor.
    sim.tickCount = slot.spawnGraceUntilTick;
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(false);
    const after = effectTargetFor(sim, slot.entity);
    expect(after).toEqual({});
    expect(sim.effects.modifyHealth(slot.entity, -5, events, { sourceTags: ["physical"] }, after)).toBe(-5);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP - 5);
  });

  it("survives neutral coasting but forfeits on the first real movement input", () => {
    handleInput(sim, playerId, { type: "input", seq: 1, moveX: 0, moveY: 0, jump: false, run: false });
    stepPlayers(sim, []);
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(true); // stood still: still safe

    handleInput(sim, playerId, { type: "input", seq: 2, moveX: 1, moveY: 0, jump: false, run: false });
    stepPlayers(sim, []);
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(false);
  });

  it("forfeits on an attack action", () => {
    queueAction(sim, playerId, { type: "attack", dirX: 1, dirY: 0 });
    processActions(sim, []);
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(false);
  });

  it("hides the player from enemy aggro until it lapses", () => {
    const body = slot.entity.body;
    const skeleton = spawnEnemy(sim, "skeleton", body.x + 0.8, body.y);
    const brain = sim.enemies.get(skeleton.id)!.brain;

    stepEnemies(sim, []);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP); // adjacent, in range — ignored anyway
    expect(brain.targetId).toBeNull();

    sim.tickCount = slot.spawnGraceUntilTick; // grace lapses
    stepEnemies(sim, []);
    expect(brain.targetId).toBe(playerId);
    expect(slot.entity.hp).toBeLessThan(PLAYER_MAX_HP); // now it bites
  });
});
