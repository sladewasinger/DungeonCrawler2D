import { describe, expect, it } from "vitest";
import { TICK_DT, WALL_RISE } from "../core/constants.js";
import {
  measureChainedPlatforms,
  measureHop,
  measureLedgeClimb,
  measureStairContinuity,
} from "./feel-harness.js";

/**
 * Asserts the redesigned jump's feel against fixed target bands, all
 * measured in whole ticks (TICK_DT, 20Hz) per the physics' discrete
 * step — see docs/PORT_PLAN.md's "Redesign after baseline" entry for
 * the bands themselves. Bands, not exact values: the harness is a
 * deterministic simulation, but the numbers are a tuning target, not a
 * contract worth pinning to the float.
 */

const DIRECTIONS = ["north", "south", "east", "west"] as const;

describe("feel — full hop", () => {
  it("reaches apex in 0.26-0.34s", () => {
    const hop = measureHop(true);
    const ascentTimeSec = hop.ascentTicks * TICK_DT;
    expect(ascentTimeSec).toBeGreaterThanOrEqual(0.26);
    expect(ascentTimeSec).toBeLessThanOrEqual(0.34);
  });

  it("apexes 2.5-2.8 tiles up, clearing a +2 ledge with >=0.5 margin", () => {
    const hop = measureHop(true);
    expect(hop.apexHeight).toBeGreaterThanOrEqual(2.5);
    expect(hop.apexHeight).toBeLessThanOrEqual(2.8);
    expect(hop.apexHeight - WALL_RISE).toBeGreaterThanOrEqual(0.5);
  });

  it("falls from apex in at most 0.8x the ascent time (asymmetric gravity)", () => {
    const hop = measureHop(true);
    const ascentTimeSec = hop.ascentTicks * TICK_DT;
    const descentTimeSec = hop.descentTicks * TICK_DT;
    expect(descentTimeSec).toBeLessThanOrEqual(0.8 * ascentTimeSec);
  });
});

describe("feel — short hop (variable jump height)", () => {
  it("apexes 1.0-1.6 tiles up — noticeably short of the full hop", () => {
    const hop = measureHop(false);
    expect(hop.apexHeight).toBeGreaterThanOrEqual(1.0);
    expect(hop.apexHeight).toBeLessThanOrEqual(1.6);
  });

  it("is meaningfully shorter than a full hop", () => {
    const full = measureHop(true);
    const short = measureHop(false);
    expect(short.apexHeight).toBeLessThan(full.apexHeight);
    expect(short.totalTicks).toBeLessThan(full.totalTicks);
  });
});

describe("feel — ledge and platform chains stay reliable", () => {
  it.each(DIRECTIONS)("clears a standing +2 ledge climb (%s)", (direction) => {
    const result = measureLedgeClimb(direction);
    expect(result.success).toBe(true);
    expect(result.finalHeight).toBe(2);
  });

  it.each(DIRECTIONS)("chains h0->h2->h4->h6 (%s)", (direction) => {
    const result = measureChainedPlatforms(direction);
    expect(result.success).toBe(true);
    expect(result.finalHeight).toBe(6);
  });
});

describe("feel — stair-ramp continuity is unaffected by the jump retune", () => {
  it("keeps max per-tick |dz| within a normal step across a 4-tile stair walk", () => {
    const metrics = measureStairContinuity();
    expect(metrics.maxUpDz).toBeLessThan(1);
    expect(metrics.maxDownDz).toBeLessThan(1);
  });
});
