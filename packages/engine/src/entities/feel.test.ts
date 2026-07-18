import { describe, expect, it } from "vitest";
import {
  measureChainedPlatforms,
  measureHop,
  measureLedgeClimb,
  measureStairContinuity,
} from "./feel-harness.js";

/**
 * Exercises the feel harness against the CURRENT (v1-ported) physics.
 * No target bands yet — the redesign wave asserts those. These tests
 * only prove the measurements run and return sane, self-consistent
 * numbers; the actual figures are reported alongside this task, not
 * pinned here (pinning them would fossilize the floaty baseline).
 */

const DIRECTIONS = ["north", "south", "east", "west"] as const;

describe("feel harness — full vs short hop", () => {
  it("measures a full hop (jump held)", () => {
    const hop = measureHop(true);
    expect(hop.totalTicks).toBeGreaterThan(0);
    expect(hop.ascentTicks).toBeGreaterThan(0);
    expect(hop.descentTicks).toBeGreaterThan(0);
    expect(hop.apexHeight).toBeGreaterThan(0);
    expect(hop.horizontalDistance).toBeGreaterThan(0);
  });

  it("measures a short hop (jump released after takeoff)", () => {
    const hop = measureHop(false);
    expect(hop.totalTicks).toBeGreaterThan(0);
    expect(hop.apexHeight).toBeGreaterThan(0);
  });

  it("descent and ascent ticks both contribute to the total", () => {
    const hop = measureHop(true);
    expect(hop.ascentTicks + hop.descentTicks).toBe(hop.totalTicks);
  });
});

describe("feel harness — ledge and platform chains", () => {
  it.each(DIRECTIONS)("measures a +2 ledge climb from a standing start (%s)", (direction) => {
    const result = measureLedgeClimb(direction);
    expect(result.direction).toBe(direction);
    expect(typeof result.success).toBe("boolean");
    expect(result.ticksUsed).toBeGreaterThan(0);
  });

  it.each(DIRECTIONS)("measures chaining h0->h2->h4->h6 (%s)", (direction) => {
    const result = measureChainedPlatforms(direction);
    expect(result.direction).toBe(direction);
    expect(typeof result.success).toBe("boolean");
    expect(result.ticksUsed).toBeGreaterThan(0);
  });
});

describe("feel harness — stair-ramp continuity", () => {
  it("measures max per-tick |dz| across a 4-tile stair walk up and down", () => {
    const metrics = measureStairContinuity();
    expect(metrics.ticksUp).toBeGreaterThan(0);
    expect(metrics.ticksDown).toBeGreaterThan(0);
    expect(metrics.maxUpDz).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDownDz).toBeGreaterThanOrEqual(0);
  });
});
