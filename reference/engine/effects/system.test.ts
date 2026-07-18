import { content } from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { createBody } from "../entities/movement";
import { makeEntity, type Entity } from "../entities/entity";
import { EffectsEngine, type EffectEvent } from "./system";

/**
 * Epic 3 unit tests: the effects engine against the real shipped
 * content — statuses, stacking, interaction rules, sanctuary
 * suppression, damage scaling, immunities.
 */

const SANCTUARY_ZONE = { minX: 100, maxX: 120 };

function makeEngine(): EffectsEngine {
  return new EffectsEngine(content, (x) => x >= SANCTUARY_ZONE.minX && x <= SANCTUARY_ZONE.maxX);
}

function player(x = 0): Entity {
  return makeEntity("player", createBody(x, 0, 0), { hp: 30, maxHp: 30, baseSpeed: 8 });
}

describe("effects engine", () => {
  it("applies a status and ticks damage over time", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];
    expect(engine.applyStatus(target, "bleeding", events)).toBe(true);
    expect(events).toContainEqual({ t: "status", id: target.id, status: "bleeding", on: true });

    // bleeding: -2 every 2s for 8s ⇒ -8 total.
    for (let i = 0; i < 100; i++) engine.tick(target, 0.1, events);
    expect(target.hp).toBe(22);
    expect(target.statuses).toHaveLength(0); // expired
    expect(events).toContainEqual({ t: "status", id: target.id, status: "bleeding", on: false });
  });

  it("refresh stacking resets duration instead of doubling damage", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "bleeding", events);
    for (let i = 0; i < 30; i++) engine.tick(target, 0.1, events); // 3s in
    engine.applyStatus(target, "bleeding", events); // refresh
    expect(target.statuses).toHaveLength(1);
    expect(target.statuses[0]!.remaining).toBe(8);
  });

  it("a status kills, exactly once", () => {
    const engine = makeEngine();
    const target = player();
    target.hp = 3;
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "on-fire", events); // -3/s
    for (let i = 0; i < 20; i++) engine.tick(target, 0.1, events);
    expect(target.hp).toBe(0);
    expect(events.filter((e) => e.t === "death")).toHaveLength(1);
  });

  it("fire + wet extinguishes both (tag interaction rule)", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "wet", events);
    engine.applyStatus(target, "on-fire", events);
    // Applying on-fire while wet triggers the rule immediately.
    expect(target.statuses.map((s) => s.defId)).not.toContain("on-fire");
    expect(target.statuses.map((s) => s.defId)).not.toContain("wet");
  });

  it("sanctuary suppresses damage and debuffs but not heals", () => {
    const engine = makeEngine();
    const target = player(110); // inside sanctuary band
    target.hp = 10;
    const events: EffectEvent[] = [];
    expect(engine.modifyHealth(target, -5, events)).toBe(0);
    expect(target.hp).toBe(10);
    expect(engine.applyStatus(target, "poisoned", events)).toBe(false);
    expect(engine.modifyHealth(target, 5, events)).toBe(5);
    expect(target.hp).toBe(15);
  });

  it("immunities block matching statuses (slime cannot bleed)", () => {
    const engine = makeEngine();
    const slime = makeEntity("enemy", createBody(0, 0, 0), { hp: 12, maxHp: 12 });
    const events: EffectEvent[] = [];
    expect(engine.applyStatus(slime, "bleeding", events, { immunities: ["bleed"] })).toBe(false);
    expect(engine.applyStatus(slime, "on-fire", events, { immunities: ["bleed"] })).toBe(true);
  });

  it("damageScale amplifies tagged damage (flammable plants burn 2x)", () => {
    const engine = makeEngine();
    const plant = makeEntity("enemy", createBody(0, 0, 0), { hp: 18, maxHp: 18 });
    const events: EffectEvent[] = [];
    engine.applyStatus(plant, "on-fire", events, { damageScale: { fire: 2 } });
    engine.tick(plant, 1.0, events, { damageScale: { fire: 2 } });
    // on-fire ticks -3, scaled ×2 ⇒ -6.
    expect(plant.hp).toBe(12);
  });

  it("speed multipliers stack across statuses", () => {
    const engine = makeEngine();
    const target = player();
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "slowed", events); // ×0.6
    engine.applyStatus(target, "wet", events); // ×0.85
    expect(engine.speedMult(target)).toBeCloseTo(0.6 * 0.85, 5);
  });

  it("bandage heals and strips bleeding via remove_status", () => {
    const engine = makeEngine();
    const target = player();
    target.hp = 20;
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "bleeding", events);
    const bandage = content.items.get("bandage")!;
    engine.runPrimitives(target, bandage.consumable!.effects, events, {}, () => 0);
    expect(target.hp).toBe(24);
    expect(target.statuses.map((s) => s.defId)).not.toContain("bleeding");
  });

  it("tagsOf includes base tags, status tags, and airborne", () => {
    const engine = makeEngine();
    const target = makeEntity("player", createBody(0, 0, 0), {
      hp: 30,
      maxHp: 30,
      tags: new Set(["player"]),
    });
    const events: EffectEvent[] = [];
    engine.applyStatus(target, "wet", events);
    expect(engine.tagsOf(target)).toContain("wet");
    expect(engine.tagsOf(target)).toContain("player");
    target.body.grounded = false;
    expect(engine.tagsOf(target)).toContain("airborne");
  });
});
