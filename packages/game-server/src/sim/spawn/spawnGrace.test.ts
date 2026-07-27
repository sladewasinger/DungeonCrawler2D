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
  PLAYER_MAX_HP,
  World,
  buildContentRegistry,
  createBody,
  hashString,
  type ContentRegistry,
  type EffectEvent,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { stepEnemies } from "../enemies/index.js";
import { damageGivenMultiplierFor, effectTargetFor, spawnEnemy } from "../core/helpers.js";
import { addPlayer } from "../players/join.js";
import { handleInput, queueAction, stepPlayers } from "../players/players.js";
import { processActions } from "../actions/index.js";
import { DEFAULT_HANDICAP, GOD_MODE_DAMAGE_MULTIPLIER } from "../progression/handicap.js";
import { isSpawnProtected } from "../spawnSafety/spawnSafety.js";
import { openFloorNear } from "../spawnSafety/testSupport.js";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";

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

describe("spawn grace", () => {
  let sim: SimState;
  let playerId: string;
  let slot: PlayerSlot;

  beforeEach(() => {
    const world = new World(hashString("spawn-grace-test"), 1, LEVEL.Dungeon);
    sim = createSimState({ world, content, store: new PlayerStore(null), rngSeed: 5, opts: { spawnRadiusTiles: 12 } });
    playerId = addPlayer(sim, { name: "Newborn", clientId: "client-g" }).playerId;
    slot = sim.players.get(playerId)!;
    // Damage paths sanctuary-suppress independently of grace — park the
    // body on known NON-sanctuary floor so every assertion isolates grace.
    const spot = openFloorNear(sim, { x: 200, y: 200 });
    slot.entity.body = createBody(spot.x, spot.y, sim.world.groundAt(spot.x, spot.y));
  });

  it("blocks damage and debuffs while active, then expires by the clock", () => {
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(true);
    expect(effectTargetFor(sim, slot.entity)).toEqual({ invulnerable: true });

    const events: EffectEvent[] = [];
    const target = effectTargetFor(sim, slot.entity);
    expect(sim.effects.modifyHealth({ entity: slot.entity, amount: -5, events, opts: { sourceTags: ["physical"] }, target })).toBe(0);
    expect(sim.effects.applyStatus({ entity: slot.entity, statusId: "poisoned", events, target })).toBe(false);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
    expect(events).toHaveLength(0);

    // SPAWN_GRACE_TICKS later the same hit connects: 2s is a mercy, not armor.
    sim.tickCount = slot.spawnGraceUntilTick;
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(false);
    const after = effectTargetFor(sim, slot.entity);
    expect(after).toEqual({});
    expect(sim.effects.modifyHealth({ entity: slot.entity, amount: -5, events, opts: { sourceTags: ["physical"] }, target: after })).toBe(-5);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP - 5);
  });

  it("survives neutral coasting but forfeits on the first real movement input", () => {
    handleInput(sim, playerId, { type: "input", seq: 1, projectedServerTick: sim.tickCount, moveX: 0, moveY: 0, jump: false, run: false });
    stepPlayers(sim, []);
    expect(isSpawnProtected(slot, sim.tickCount)).toBe(true); // stood still: still safe

    handleInput(sim, playerId, { type: "input", seq: 2, projectedServerTick: sim.tickCount, moveX: 1, moveY: 0, jump: false, run: false });
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
    const skeleton = spawnEnemy(sim, { defId: "skeleton", x: body.x + 0.8, y: body.y });
    const brain = sim.enemies.get(skeleton.id)!.brain;

    stepEnemies(sim, []);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP); // adjacent, in range — ignored anyway
    expect(brain.targetId).toBeNull();

    sim.tickCount = slot.spawnGraceUntilTick; // grace lapses
    stepEnemies(sim, []);
    expect(brain.targetId).toBe(playerId);
    expect(slot.entity.hp).toBeLessThan(PLAYER_MAX_HP); // now it bites
  });

  it("applies the name-based handicap after spawn grace expires", () => {
    const handicappedId = addPlayer(sim, { name: "ELLIE-the-crawler", clientId: "client-ellie" }).playerId;
    const handicapped = sim.players.get(handicappedId)!;
    sim.tickCount = handicapped.spawnGraceUntilTick;
    const events: EffectEvent[] = [];

    const expectedDamage = -5 * DEFAULT_HANDICAP.damageTakenMultiplier;
    expect(effectTargetFor(sim, handicapped.entity)).toEqual({
      damageTakenMultiplier: DEFAULT_HANDICAP.damageTakenMultiplier,
    });
    expect(sim.effects.modifyHealth({
      entity: handicapped.entity,
      amount: -5,
      events,
      opts: { sourceTags: ["physical"] },
      target: effectTargetFor(sim, handicapped.entity),
    })).toBe(expectedDamage);
    expect(handicapped.entity.hp).toBe(PLAYER_MAX_HP + expectedDamage);
    expect(damageGivenMultiplierFor(sim, handicapped.entity)).toBe(
      DEFAULT_HANDICAP.damageGivenMultiplier,
    );
  });

  it("uses the configured god-mode outgoing damage multiplier", () => {
    slot.god = true;
    expect(damageGivenMultiplierFor(sim, slot.entity)).toBe(GOD_MODE_DAMAGE_MULTIPLIER);
  });
});
