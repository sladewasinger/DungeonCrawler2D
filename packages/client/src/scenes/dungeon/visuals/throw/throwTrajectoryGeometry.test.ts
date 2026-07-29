/** Focused checks for the shared terrain-aware throw trajectory. */
import {
  createBallisticFlight,
  resolveBallisticThrow,
  throwLaunchOrigin,
  traceBallisticFlight,
  type WorldView,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { ballisticThrowArc } from "./throwTrajectoryGeometry.js";

interface ThrowParityCase {
  readonly name: string;
  readonly origin: { x: number; y: number; z: number };
  readonly target: { x: number; y: number };
  readonly groundAt: (x: number, y: number) => number;
  readonly isWalkable?: (x: number, y: number) => boolean;
}

function testWorld(testCase: ThrowParityCase): WorldView {
  return {
    isWalkable: testCase.isWalkable ?? (() => true),
    heightAt: (x, y) => testCase.groundAt(x + 0.5, y + 0.5),
    groundAt: testCase.groundAt,
    stairHeightAt: () => null,
  };
}

const throwParityCases: readonly ThrowParityCase[] = [
  {
    name: "flat",
    origin: { x: 1.5, y: 1.5, z: 0 },
    target: { x: 5.5, y: 1.5 },
    groundAt: () => 0,
  },
  {
    name: "raised target",
    origin: { x: 1.5, y: 1.5, z: 0 },
    target: { x: 4.5, y: 1.5 },
    groundAt: (x) => x >= 4 ? 2 : 0,
  },
  {
    name: "lowered target",
    origin: { x: 1.5, y: 1.5, z: 2 },
    target: { x: 4.5, y: 1.5 },
    groundAt: (x) => x >= 2 ? -1.5 : 2,
  },
  {
    name: "near",
    origin: { x: 1.5, y: 1.5, z: 0.25 },
    target: { x: 1.7, y: 1.65 },
    groundAt: () => 0,
  },
  {
    name: "maximum range",
    origin: { x: 1.5, y: 1.5, z: 0 },
    target: { x: 30, y: 1.5 },
    groundAt: () => 0,
  },
  {
    name: "diagonal",
    origin: { x: 1.5, y: 1.5, z: 0.5 },
    target: { x: 5.5, y: 4.5 },
    groundAt: () => 0,
  },
  {
    name: "blocking terrain",
    origin: { x: 1.5, y: 1.5, z: 0 },
    target: { x: 5.5, y: 1.5 },
    groundAt: () => 0,
    isWalkable: (x, y) => x !== 3 || y !== 1,
  },
];

describe("ballistic throw trajectory", () => {
  it.each(throwParityCases)("ends at the authoritative terrain trace for $name", (testCase) => {
    const world = testWorld(testCase);
    const origin = throwLaunchOrigin(testCase.origin);
    const ballistic = resolveBallisticThrow({ world, from: origin, target: testCase.target });
    const flight = createBallisticFlight(origin, ballistic);
    const authoritative = traceBallisticFlight({ world, flight, segments: 8 });
    const preview = ballisticThrowArc({ world, ...testCase, segments: 8 });

    expect(preview.points).toEqual(authoritative.points);
    expect(preview.target).toEqual(authoritative.impact ?? ballistic.target);
    expect(preview.points[0]).toEqual(origin);
    expect(preview.points.at(-1)).toEqual(preview.target);
  });

  it("clamps the preview target to the shared maximum range", () => {
    const testCase = throwParityCases.find(({ name }) => name === "maximum range");
    if (testCase === undefined) throw new Error("Missing maximum range throw fixture");
    const preview = ballisticThrowArc({ world: testWorld(testCase), ...testCase });
    const origin = throwLaunchOrigin(testCase.origin);
    expect(Math.hypot(preview.target.x - origin.x, preview.target.y - origin.y)).toBeCloseTo(8);
  });
});
