import { MOVE_SPEED, TICK_DT } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  runMovementModifierTimeline,
  type MovementTimelineSample,
} from "./predictionMovementTimelineSupport.js";

const APPLY_TICK = 3;
const SNAPSHOT_DELAY_TICKS = 2;

function expectStableAfterDiscovery(samples: readonly MovementTimelineSample[]): void {
  const discoveryTick = APPLY_TICK + SNAPSHOT_DELAY_TICKS;
  expect(samples.find(({ tick }) => tick === discoveryTick)?.correction)
    .toBeGreaterThan(0);
  for (const sample of samples.slice(discoveryTick)) {
    expect(sample.correction ?? 0).toBeCloseTo(0, 6);
    expect(sample.renderedSpeed).toBeCloseTo(sample.projectedSpeed, 6);
  }
}

describe("movement modifier prediction timeline", () => {
  it("stays correction-free after learning a delayed slow, through expiry", () => {
    const samples = runMovementModifierTimeline([
      { id: "slowed", remainingSeconds: TICK_DT * 8 },
    ]);
    expectStableAfterDiscovery(samples);
    expect(samples[8]?.projectedSpeed).toBeCloseTo(MOVE_SPEED * 0.6);
    expect(samples[9]?.projectedSpeed).toBeCloseTo(MOVE_SPEED);
  });

  it("keeps stacked and concurrent modifiers aligned across snapshots", () => {
    const samples = runMovementModifierTimeline([
      { id: "stacked-slow", remainingSeconds: TICK_DT * 10, stacks: 2 },
      { id: "wet", remainingSeconds: TICK_DT * 6 },
    ]);
    expectStableAfterDiscovery(samples);
    expect(samples[5]?.projectedSpeed).toBeCloseTo(MOVE_SPEED * 0.8 ** 2 * 0.75);
    expect(samples[8]?.projectedSpeed).toBeCloseTo(MOVE_SPEED * 0.8 ** 2);
  });
});
