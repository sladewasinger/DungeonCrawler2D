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
  createPlayerResourceStep,
  stepPlayerResources,
  stepPlayerResourcesInto,
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
    const first = stepPlayerResources({ state: resources, input: { moveX: 1, moveY: 0, jump: false, run: true }, canBlock: true, dt: 1 });
    expect(first.sprinting).toBe(true);
    expect(resources.stamina).toBe(0);
    const exhausted = stepPlayerResources({ state: resources, input: { moveX: 1, moveY: 0, jump: false, run: true }, canBlock: true, dt: 0.05 });
    expect(exhausted.input.run).toBe(false);
  });

  it("holds at zero, then recovers above a restart threshold without flicker", () => {
    const resources = state(SPRINT_STAMINA_PER_SECOND);
    const running = { moveX: 1, moveY: 0, jump: false, run: true };
    stepPlayerResources({ state: resources, input: running, canBlock: true, dt: 1 });
    expect(resources.stamina).toBe(0);
    expect(resources.staminaRecoveryDelaySeconds)
      .toBe(STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS);
    expect(resources.staminaExhausted).toBe(true);

    for (
      let second = 0;
      second < STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS;
      second += 1
    ) {
      const exhausted = stepPlayerResources({ state: resources, input: running, canBlock: true, dt: 1 });
      expect(exhausted.sprinting).toBe(false);
      expect(resources.stamina).toBe(0);
    }

    const firstRecovery = stepPlayerResources({ state: resources, input: running, canBlock: true, dt: 1 });
    expect(firstRecovery.sprinting).toBe(false);
    expect(resources.stamina).toBe(WALK_STAMINA_RECOVERY_PER_SECOND);

    const secondRecovery = stepPlayerResources({ state: resources, input: running, canBlock: true, dt: 1 });
    expect(secondRecovery.sprinting).toBe(false);
    expect(resources.stamina).toBe(
      2 * WALK_STAMINA_RECOVERY_PER_SECOND,
    );
    expect(resources.stamina).toBeGreaterThanOrEqual(
      resources.maxStamina * STAMINA_EXHAUSTION_RECOVERY_FRACTION,
    );
    expect(resources.staminaExhausted).toBe(false);

    const resumed = stepPlayerResources({ state: resources, input: running, canBlock: true, dt: 0.05 });
    expect(resumed.sprinting).toBe(true);
    expect(resources.stamina).toBeLessThan(
      2 * WALK_STAMINA_RECOVERY_PER_SECOND,
    );
  });

  it("gives blocking priority and requires a weapon", () => {
    const resources = state();
    const blocked = stepPlayerResources({ state: resources, input: { moveX: 1, moveY: 0, jump: false, run: true, block: true }, canBlock: true, dt: 1 });
    expect(blocked.input).toMatchObject({ run: false, block: true });
    expect(resources.stamina).toBe(100 - BLOCK_STAMINA_PER_SECOND);

    const unarmed = state();
    expect(stepPlayerResources({ state: unarmed, input: { moveX: 0, moveY: 0, jump: false, block: true }, canBlock: false, dt: 1 }).input.block).toBe(false);
  });

  it("recovers faster while idle than while walking and clamps at max", () => {
    const walking = state(10);
    const idle = state(10);
    stepPlayerResources({ state: walking, input: { moveX: 1, moveY: 0, jump: false }, canBlock: true, dt: 1 });
    stepPlayerResources({ state: idle, input: { moveX: 0, moveY: 0, jump: false }, canBlock: true, dt: 1 });
    expect(walking.stamina).toBe(10 + WALK_STAMINA_RECOVERY_PER_SECOND);
    expect(idle.stamina).toBe(10 + IDLE_STAMINA_RECOVERY_PER_SECOND);
    const full = state(99);
    stepPlayerResources({ state: full, input: { moveX: 0, moveY: 0, jump: false }, canBlock: true, dt: 1 });
    expect(full.stamina).toBe(100);
  });

  it("reuses an explicit output record without changing effective controls", () => {
    const resources = state();
    const output = createPlayerResourceStep();
    const input = {
      moveX: 0.5,
      moveY: -0.25,
      faceX: -1,
      faceY: 0,
      jump: true,
      run: true,
      block: true,
    };
    const inputIdentity = output.input;

    for (let tick = 0; tick < 1_000; tick++) {
      expect(stepPlayerResourcesInto({ state: resources, input, canBlock: true, dt: 0, output })).toBe(output);
      expect(output.input).toBe(inputIdentity);
    }

    expect(output.input).toEqual({ ...input, run: false, block: true });
    expect(output.sprinting).toBe(false);
  });
});
