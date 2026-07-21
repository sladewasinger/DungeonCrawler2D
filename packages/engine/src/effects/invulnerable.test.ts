import { describe, expect, it } from "vitest";
import { createBody } from "../entities/movement/index.js";
import { makeEntity, type Entity } from "../entities/entity.js";
import { buildContentRegistry, type RawContent } from "./types.js";
import { EffectsEngine, type EffectEvent } from "./system.js";

/**
 * EffectTarget.invulnerable (spawn-grace protection, panel round 3b
 * blocker #1): hostile health deltas and debuffs are dropped outright,
 * while heals and buffs still land. Split from system.test.ts (already
 * at the 200-line file cap).
 */

const FIXTURE: RawContent = {
  statuses: [
    {
      id: "poisoned",
      name: "Poisoned",
      kind: "debuff",
      tags: ["poison"],
      duration: 10,
      tickEvery: 2,
      stacking: "refresh",
      onTick: [{ primitive: "modify_health", amount: -1 }],
    },
    {
      id: "bandaged",
      name: "Bandaged",
      kind: "buff",
      tags: ["heal"],
      duration: 1,
      stacking: "refresh",
      onApply: [{ primitive: "modify_health", amount: 4 }],
    },
  ],
  rules: [],
  areas: [],
  items: [],
  enemies: [],
  recipes: [],
};

function makeEngine(): EffectsEngine {
  return new EffectsEngine(buildContentRegistry(FIXTURE), () => false);
}

function player(): Entity {
  return makeEntity("player", createBody(0, 0, 0), { hp: 30, maxHp: 30, baseSpeed: 8 });
}

describe("EffectTarget.invulnerable", () => {
  it("drops hostile damage entirely — no hp change, no hp/death events", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];

    expect(engine.modifyHealth(target, -5, events, { sourceTags: ["physical"] }, { invulnerable: true })).toBe(0);
    // Even lethal damage is dropped, not clamped.
    expect(engine.modifyHealth(target, -999, events, {}, { invulnerable: true })).toBe(0);

    expect(target.hp).toBe(30);
    expect(events).toHaveLength(0);
  });

  it("still lets heals through", () => {
    const engine = makeEngine();
    const target = player();
    target.hp = 20;
    const events: EffectEvent[] = [];

    expect(engine.modifyHealth(target, 5, events, {}, { invulnerable: true })).toBe(5);
    expect(target.hp).toBe(25);
  });

  it("blocks debuff application but not buffs", () => {
    const engine = makeEngine();
    const target = player();
    target.hp = 20;
    const events: EffectEvent[] = [];

    expect(engine.applyStatus(target, "poisoned", events, { invulnerable: true })).toBe(false);
    expect(target.statuses).toHaveLength(0);

    // bandaged is a buff: applies and its onApply heal (+4) runs → 24.
    expect(engine.applyStatus(target, "bandaged", events, { invulnerable: true })).toBe(true);
    expect(target.hp).toBe(24);
  });

  it("without the flag the same damage lands (guard is opt-in)", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];

    expect(engine.modifyHealth(target, -5, events, { sourceTags: ["physical"] }, {})).toBe(-5);
    expect(target.hp).toBe(25);
  });
});
