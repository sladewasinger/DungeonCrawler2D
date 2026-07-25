import { describe, expect, it } from "vitest";
import {
  BLOCK_STAMINA_PER_SECOND,
  IDLE_STAMINA_RECOVERY_PER_SECOND,
  SPRINT_STAMINA_PER_SECOND,
  STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS,
  STAMINA_EXHAUSTION_RECOVERY_FRACTION,
  WALK_STAMINA_RECOVERY_PER_SECOND,
} from "../core/constants.js";
import {
  stepPlayerResources,
  type PlayerResourceState,
} from "./playerResources.js";

const state = (stamina = 100): PlayerResourceState => ({
  stamina,
  maxStamina: 100,
  blocking: false,
});

describe("stepPlayerResources", () => {
  it("drains moving sprint and removes sprint when exhausted", () => {
    const resources = state(SPRINT_STAMINA_PER_SECOND);
    const first = stepPlayerResources(
      resources,
      { moveX: 1, moveY: 0, jump: false, run: true },
      true,
      1,
    );
    expect(first.sprinting).toBe(true);
    expect(resources.stamina).toBe(0);
    const exhausted = stepPlayerResources(
      resources,
      { moveX: 1, moveY: 0, jump: false, run: true },
      true,
      0.05,
    );
    expect(exhausted.input.run).toBe(false);
  });

  it("holds at zero, then recovers above a restart threshold without flicker", () => {
    const resources = state(SPRINT_STAMINA_PER_SECOND);
    const running = { moveX: 1, moveY: 0, jump: false, run: true };
    stepPlayerResources(resources, running, true, 1);
    expect(resources.stamina).toBe(0);
    expect(resources.staminaRecoveryDelaySeconds)
      .toBe(STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS);
    expect(resources.staminaExhausted).toBe(true);

    for (
      let second = 0;
      second < STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS;
      second += 1
    ) {
      const exhausted = stepPlayerResources(resources, running, true, 1);
      expect(exhausted.sprinting).toBe(false);
      expect(resources.stamina).toBe(0);
    }

    const firstRecovery = stepPlayerResources(resources, running, true, 1);
    expect(firstRecovery.sprinting).toBe(false);
    expect(resources.stamina).toBe(WALK_STAMINA_RECOVERY_PER_SECOND);

    const secondRecovery = stepPlayerResources(resources, running, true, 1);
    expect(secondRecovery.sprinting).toBe(false);
    expect(resources.stamina).toBe(
      2 * WALK_STAMINA_RECOVERY_PER_SECOND,
    );
    expect(resources.stamina).toBeGreaterThanOrEqual(
      resources.maxStamina * STAMINA_EXHAUSTION_RECOVERY_FRACTION,
    );
    expect(resources.staminaExhausted).toBe(false);

    const resumed = stepPlayerResources(resources, running, true, 0.05);
    expect(resumed.sprinting).toBe(true);
    expect(resources.stamina).toBeLessThan(
      2 * WALK_STAMINA_RECOVERY_PER_SECOND,
    );
  });

  it("gives blocking priority and requires a weapon", () => {
    const resources = state();
    const blocked = stepPlayerResources(
      resources,
      { moveX: 1, moveY: 0, jump: false, run: true, block: true },
      true,
      1,
    );
    expect(blocked.input).toMatchObject({ run: false, block: true });
    expect(resources.stamina).toBe(100 - BLOCK_STAMINA_PER_SECOND);

    const unarmed = state();
    expect(stepPlayerResources(
      unarmed,
      { moveX: 0, moveY: 0, jump: false, block: true },
      false,
      1,
    ).input.block).toBe(false);
  });

  it("recovers faster while idle than while walking and clamps at max", () => {
    const walking = state(10);
    const idle = state(10);
    stepPlayerResources(
      walking,
      { moveX: 1, moveY: 0, jump: false },
      true,
      1,
    );
    stepPlayerResources(
      idle,
      { moveX: 0, moveY: 0, jump: false },
      true,
      1,
    );
    expect(walking.stamina).toBe(10 + WALK_STAMINA_RECOVERY_PER_SECOND);
    expect(idle.stamina).toBe(10 + IDLE_STAMINA_RECOVERY_PER_SECOND);
    const full = state(99);
    stepPlayerResources(
      full,
      { moveX: 0, moveY: 0, jump: false },
      true,
      1,
    );
    expect(full.stamina).toBe(100);
  });
});
