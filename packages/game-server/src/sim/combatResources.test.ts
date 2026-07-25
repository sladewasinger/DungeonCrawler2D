import {
  HEALTH_REGEN_DELAY_SECONDS,
  TICK_RATE,
  type EffectEvent,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { applyHealthRegeneration } from "./combatResources.js";
import type { SimState } from "./state.js";

const simAt = (tickCount: number, hp = 20) => {
  const entity = { id: "p", hp, maxHp: 30 };
  const slot = {
    entity,
    connected: true,
    downedAtTick: null,
    lastDamageAtTick: 0,
  };
  const sim = {
    tickCount,
    players: new Map([["p", slot]]),
    effects: {
      modifyHealth(target: typeof entity, amount: number, events: EffectEvent[]) {
        target.hp = Math.min(target.maxHp, target.hp + amount);
        events.push({ t: "hp", id: target.id, delta: amount, hp: target.hp });
      },
    },
  } as unknown as SimState;
  return { sim, entity, slot };
};

describe("applyHealthRegeneration", () => {
  it("waits for the full no-damage delay before healing", () => {
    const delay = HEALTH_REGEN_DELAY_SECONDS * TICK_RATE;
    const before = simAt(delay - 1);
    applyHealthRegeneration(before.sim, []);
    expect(before.entity.hp).toBe(20);

    const ready = simAt(delay);
    applyHealthRegeneration(ready.sim, []);
    expect(ready.entity.hp).toBeGreaterThan(20);
  });

  it("records same-tick damage and suppresses regeneration", () => {
    const current = simAt(10_000);
    const events: EffectEvent[] = [{
      t: "hp",
      id: "p",
      delta: -2,
      hp: 18,
    }];
    applyHealthRegeneration(current.sim, events);
    expect(current.slot.lastDamageAtTick).toBe(10_000);
    expect(current.entity.hp).toBe(20);
    expect(events).toHaveLength(1);
  });
});
