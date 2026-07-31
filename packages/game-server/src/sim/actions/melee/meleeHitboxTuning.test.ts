import { TICK_RATE, WEAPON_HITBOX_TUNING } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  isFinalMeleeHitboxResolutionTick,
  isMeleeHitboxResolutionTick,
  MELEE_HITBOX_TIMING,
} from "./meleeHitboxTuning.js";

describe("authoritative melee hitbox timing", () => {
  it("resolves at 0, 50, 100, and 150ms, then ends before 200ms", () => {
    const startedAtTick = 40;
    const lastOffset = MELEE_HITBOX_TIMING.lastResolutionOffsetTicks;
    const tickMs = 1000 / TICK_RATE;

    expect(WEAPON_HITBOX_TUNING.activeDurationMs).toBe(160);
    expect(lastOffset).toBe(3);
    expect(lastOffset * tickMs).toBeLessThan(WEAPON_HITBOX_TUNING.activeDurationMs);
    expect((lastOffset + 1) * tickMs).toBeGreaterThanOrEqual(
      WEAPON_HITBOX_TUNING.activeDurationMs,
    );
    expect([0, 1, 2, 3].every((offset) =>
      isMeleeHitboxResolutionTick(startedAtTick + offset, startedAtTick))).toBe(true);
    expect(isMeleeHitboxResolutionTick(startedAtTick + 4, startedAtTick)).toBe(false);
    expect(isFinalMeleeHitboxResolutionTick(startedAtTick + 3, startedAtTick)).toBe(true);
  });
});
