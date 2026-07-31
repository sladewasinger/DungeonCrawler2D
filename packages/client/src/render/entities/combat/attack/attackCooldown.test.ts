import { describe, expect, it } from "vitest";
import type { PlayerVisual } from "../../visuals/state.js";
import {
  ATTACK_READY_FLASH_DURATION_MS,
  attackReadyFlashForVisual,
  attackCooldownState,
  stepAttackReadyFlash,
} from "./attackCooldown.js";

describe("attack cooldown state", () => {
  it("reports ready before the first attack", () => {
    expect(attackCooldownState(undefined, 350, 100)).toEqual({
      ready: true,
      progress: 1,
      remainingMs: 0,
    });
  });

  it("reports progress and remaining time during recovery", () => {
    expect(attackCooldownState(100, 400, 300)).toEqual({
      ready: false,
      progress: 0.5,
      remainingMs: 200,
    });
  });

  it("becomes ready exactly at the profile cadence", () => {
    expect(attackCooldownState(100, 400, 500).ready).toBe(true);
    expect(attackCooldownState(100, 400, 500).remainingMs).toBe(0);
  });
});

describe("attack ready flash", () => {
  it("starts once when a recorded cooldown becomes ready", () => {
    const tracker = { acknowledged: false, startedAtMs: undefined };
    const cooling = { ready: false, progress: 0.9, remainingMs: 20 };
    const ready = { ready: true, progress: 1, remainingMs: 0 };

    expect(stepAttackReadyFlash({
      tracker,
      state: cooling,
      nowMs: 980,
      downed: false,
    })).toBe(false);
    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_000,
      downed: false,
    })).toBe(true);
    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_000 + ATTACK_READY_FLASH_DURATION_MS - 1,
      downed: false,
    })).toBe(true);
    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_000 + ATTACK_READY_FLASH_DURATION_MS,
      downed: false,
    })).toBe(false);
  });

  it("suppresses and consumes a ready transition while downed", () => {
    const tracker = { acknowledged: false, startedAtMs: undefined };
    const ready = { ready: true, progress: 1, remainingMs: 0 };

    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_000,
      downed: true,
    })).toBe(false);
    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_010,
      downed: false,
    })).toBe(false);
    expect(tracker.startedAtMs).toBeUndefined();
  });

  it("cannot flash without a tracked recovery transition", () => {
    const tracker = { acknowledged: true, startedAtMs: undefined };
    const ready = { ready: true, progress: 1, remainingMs: 0 };

    expect(stepAttackReadyFlash({
      tracker,
      state: ready,
      nowMs: 1_000,
      downed: false,
    })).toBe(false);
  });

  it("does not flash initial ready state or a weapon-only presentation change", () => {
    const visual = {} as PlayerVisual;
    const ready = { ready: true, progress: 1, remainingMs: 0 };

    expect(attackReadyFlashForVisual({
      visual,
      state: ready,
      nowMs: 1_000,
      downed: false,
    }))
      .toBe(false);
  });
});
