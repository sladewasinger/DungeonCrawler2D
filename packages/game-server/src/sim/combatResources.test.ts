import {
  HEALTH_REGEN_DELAY_SECONDS,
  PLAYER_MAX_STAMINA,
  TICK_RATE,
  type EffectEvent,
  type MoveInput,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { advancePlayerResources, applyHealthRegeneration } from "./combatResources.js";
import type { PlayerSlot, SimState } from "./state.js";

const simAt = (tickCount: number, hp = 20) => {
  const entity = { id: "p", hp, maxHp: 30 };
  const slot = {
    entity,
    connected: true,
    downedAtTick: null as number | null,
    respawnAtTick: null as number | null,
    lastDamageAtTick: 0,
  };
  const sim = {
    tickCount,
    players: new Map([["p", slot]]),
    effects: {
      modifyHealth(
        target: typeof entity,
        amount: number,
        events: EffectEvent[],
        options: { healthSource?: "automatic" } = {},
      ) {
        target.hp = Math.min(target.maxHp, target.hp + amount);
        events.push({
          t: "hp",
          id: target.id,
          delta: amount,
          hp: target.hp,
          ...(options.healthSource === undefined ? {} : { source: options.healthSource }),
        });
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

  it("marks passive regeneration so clients can suppress floating numbers", () => {
    const ready = simAt(HEALTH_REGEN_DELAY_SECONDS * TICK_RATE);
    const events: EffectEvent[] = [];
    applyHealthRegeneration(ready.sim, events);
    expect(events).toEqual([{
      t: "hp",
      id: "p",
      delta: 0.5,
      hp: 20.5,
      source: "automatic",
    }]);
  });

  it("does not heal a downed player or a scheduled corpse", () => {
    const downed = simAt(HEALTH_REGEN_DELAY_SECONDS * TICK_RATE, 1);
    downed.slot.downedAtTick = 1;
    applyHealthRegeneration(downed.sim, []);
    expect(downed.entity.hp).toBe(1);

    const dead = simAt(HEALTH_REGEN_DELAY_SECONDS * TICK_RATE, 1);
    dead.slot.respawnAtTick = dead.sim.tickCount + TICK_RATE;
    applyHealthRegeneration(dead.sim, []);
    expect(dead.entity.hp).toBe(1);
  });
});

describe("advancePlayerResources", () => {
  it("keeps god-mode stamina full while sprinting and blocking", () => {
    const slot = {
      god: true,
      weapon: "sword",
      stamina: 1,
      maxStamina: PLAYER_MAX_STAMINA,
      blocking: false,
      staminaRecoveryDelaySeconds: 3,
      staminaExhausted: true,
    } as unknown as PlayerSlot;
    const sprint: MoveInput = { moveX: 1, moveY: 0, jump: false, run: true };
    const block: MoveInput = { moveX: 0, moveY: 0, jump: false, block: true };

    expect(advancePlayerResources(slot, sprint).run).toBe(true);
    expect(advancePlayerResources(slot, block).block).toBe(true);
    expect(slot.stamina).toBe(PLAYER_MAX_STAMINA);
    expect(slot.staminaRecoveryDelaySeconds).toBe(0);
    expect(slot.staminaExhausted).toBe(false);
  });
});
