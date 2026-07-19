import { describe, expect, it } from "vitest";
import { AIRBORNE_LEDGE_CLEARANCE, KNOCKBACK_FORCE, STEP_UP, TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { NEUTRAL_INPUT, applyKnockback, createBody, stepBody, type StepResult } from "./movement/index.js";

/**
 * Elevation-model audit: targeted regressions for step-up continuity,
 * ledge-grip false triggers, knockback landings, and the diagonal
 * corner-clip class of bug — probing beyond the jump-arc feel harness.
 */

function fakeWorld(opts: {
  heightFn?: (x: number, y: number) => number;
  groundFn?: (x: number, y: number) => number;
}): WorldView {
  const heightAt = (x: number, y: number): number => (opts.heightFn ? opts.heightFn(x, y) : 0);
  return {
    isWalkable: () => true,
    heightAt,
    groundAt: (x, y) => (opts.groundFn ? opts.groundFn(x, y) : heightAt(Math.floor(x), Math.floor(y))),
  };
}

function runTicks(world: WorldView, body: ReturnType<typeof createBody>, input: Parameters<typeof stepBody>[2], ticks: number): StepResult[] {
  const results: StepResult[] = [];
  for (let i = 0; i < ticks; i++) results.push(stepBody(world, body, input, TICK_DT));
  return results;
}

describe("diagonal corner-clip", () => {
  it("a grounded body cannot snap onto a lone diagonal spike more than STEP_UP tall", () => {
    // Only tile (8,8) is raised (4 tiles); every cardinal-adjacent tile is
    // flat 0. BODY_RADIUS makes the leading diagonal corner touch (8,8)
    // before the body's center ever crosses into that column — the
    // corner check must gate on the body's OWN z, not reuse that same
    // corner's terrain as its own "before" reference.
    const world = fakeWorld({
      heightFn: (x, y) => (Math.floor(x) === 8 && Math.floor(y) === 8 ? 4 : 0),
      groundFn: (x, y) => (Math.floor(x) === 8 && Math.floor(y) === 8 ? 4 : 0),
    });
    const body = createBody(7.9, 7.9, 0);
    // Track the max z reached: the body never jumps, so a grounded body
    // should never exceed STEP_UP above its starting ground — reaching
    // the spike's full height would mean it clipped straight up onto it
    // (then walked back off, which a final-state-only check would miss).
    let maxZ = 0;
    for (let i = 0; i < 40; i++) {
      stepBody(world, body, { moveX: 1, moveY: 1, jump: false }, TICK_DT);
      maxZ = Math.max(maxZ, body.z);
    }
    expect(maxZ).toBeLessThanOrEqual(STEP_UP);
    expect(body.grounded).toBe(true);
  });

  it("still allows a diagonal step onto a corner within STEP_UP", () => {
    const world = fakeWorld({
      heightFn: (x, y) => (Math.floor(x) >= 8 && Math.floor(y) >= 8 ? STEP_UP : 0),
      groundFn: (x, y) => (Math.floor(x) >= 8 && Math.floor(y) >= 8 ? STEP_UP : 0),
    });
    const body = createBody(7.9, 7.9, 0);
    runTicks(world, body, { moveX: 1, moveY: 1, jump: false }, 10);
    expect(Math.floor(body.x)).toBeGreaterThanOrEqual(8);
    expect(Math.floor(body.y)).toBeGreaterThanOrEqual(8);
    expect(body.z).toBeCloseTo(STEP_UP, 5);
    expect(body.grounded).toBe(true);
  });
});

describe("STEP_UP walking, up and down", () => {
  // Each tile rises 0.3 — comfortably under the post-rescale STEP_UP
  // (0.35), unlike a flat 1-per-tile staircase (that magnitude now
  // exceeds STEP_UP and free-falls instead — see the chasm/threshold
  // ramp fixes in world/generate/height.ts for the real-content version
  // of this same rule).
  const STAIR_STEP = 0.3;

  it("climbs a staircase of small steps with no airborne flicker and no speed loss", () => {
    const world = fakeWorld({ heightFn: (x) => Math.max(0, Math.floor(x) - 7) * STAIR_STEP });
    const body = createBody(5.5, 5.5, 0);
    const xs: number[] = [];
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      xs.push(body.x);
      expect(body.grounded).toBe(true);
    }
    for (let i = 1; i < xs.length; i++) {
      expect((xs[i] as number) - (xs[i - 1] as number)).toBeCloseTo(0.4, 5);
    }
  });

  it("descends a staircase of small steps with no airborne flicker and no speed loss", () => {
    const heightFn = (x: number): number => Math.max(0, 22 - Math.floor(x)) * STAIR_STEP;
    const world = fakeWorld({ heightFn });
    const body = createBody(5.5, 5.5, heightFn(5.5));
    const xs: number[] = [];
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      xs.push(body.x);
      expect(body.grounded).toBe(true);
    }
    for (let i = 1; i < xs.length; i++) {
      expect((xs[i] as number) - (xs[i - 1] as number)).toBeCloseTo(0.4, 5);
    }
  });
});

describe("ledge-grip edge cases", () => {
  it("walking off a ledge never gains upward velocity without a jump input", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 5 : 0) });
    const body = createBody(7.9, 5.5, 5);
    let landings = 0;
    let maxZVel = -Infinity;
    for (let i = 0; i < 60; i++) {
      const r = stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      if (r.landed) landings++;
      maxZVel = Math.max(maxZVel, body.zVel);
    }
    expect(landings).toBe(1); // no double-land
    expect(maxZVel).toBeLessThanOrEqual(0); // no phantom jump
  });

  it("rising within AIRBORNE_LEDGE_CLEARANCE of a ledge snaps onto it instead of clipping", () => {
    const terrain = 2;
    const world = fakeWorld({ heightFn: () => terrain, groundFn: () => terrain });
    const body = createBody(5.5, 5.5, terrain - (AIRBORNE_LEDGE_CLEARANCE - 0.01));
    body.grounded = false;
    body.zVel = 0.3;
    const r = stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    expect(r.landed).toEqual({ fallHeight: 0 });
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(terrain, 5);
  });

  it("a jump arc that falls short of a too-tall ledge is blocked the whole way, never clips onto it", () => {
    const ledgeHeight = 3; // above the full-hop apex (~1.3): unreachable without a taller jump
    const world = fakeWorld({ heightFn: (x) => (x >= 8 ? ledgeHeight : 0) });
    const body = createBody(7.4, 5.5, 0);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    for (let i = 0; i < 60; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      expect(body.x).toBeLessThan(8); // never enters the too-tall column
    }
    expect(body.grounded).toBe(true);
    expect(body.z).toBe(0); // back on the low ground it started from
  });
});

describe("knockback off ledges", () => {
  it("knocks a body off a ledge and lands it correctly, exactly once", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 3 : 0) });
    const body = createBody(7.9, 5.5, 3);
    applyKnockback(body, 1, 0, KNOCKBACK_FORCE);
    let landings = 0;
    let fallHeight = -1;
    for (let i = 0; i < 60; i++) {
      const r = stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
      if (r.landed) {
        landings++;
        fallHeight = r.landed.fallHeight;
      }
    }
    expect(landings).toBe(1);
    expect(fallHeight).toBeCloseTo(3, 1);
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(0, 5);
  });
});
