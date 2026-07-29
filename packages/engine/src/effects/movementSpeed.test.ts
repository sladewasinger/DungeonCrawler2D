import { describe, expect, it } from "vitest";
import type { ActiveStatus } from "../entities/entity.js";
import { TICK_DT } from "../core/constants.js";
import type { StatusDef } from "./types.js";
import {
  projectContinuousMovementSpeeds,
  resolveContinuousMovementSpeed,
} from "./movementSpeed.js";

const DEFINITIONS = new Map<string, StatusDef>([
  statusDefinition("slowed", 0.6),
  statusDefinition("wet", 0.85),
  statusDefinition("oiled", 0.6),
  statusDefinition("future-haste", 1.1),
]);

function statusDefinition(id: string, multiplier: number): [string, StatusDef] {
  return [id, {
    id,
    name: id,
    kind: "debuff",
    tags: [],
    duration: 4,
    stacking: "refresh",
    whileActive: [{
      primitive: "modify_stat",
      stat: "speed",
      mult: multiplier,
    }],
  }];
}

function active(defId: string, stacks = 1): ActiveStatus {
  return { defId, stacks, remaining: 4, tickAccum: 0 };
}

function resolve(statuses: readonly ActiveStatus[]): number {
  return resolveContinuousMovementSpeed({
    baseSpeed: 10,
    statuses,
    statusDefinition: (statusId) => DEFINITIONS.get(statusId),
  });
}

function snapshot(
  id: string,
  remainingSeconds: number | null,
  stacks = 1,
) {
  return { id, remainingSeconds, ...(stacks > 1 ? { stacks } : {}) };
}

function project(
  currentSpeed: number,
  statuses: readonly ReturnType<typeof snapshot>[],
  tickCount: number,
): readonly number[] {
  return projectContinuousMovementSpeeds({
    currentSpeed,
    statuses,
    tickCount,
    tickDuration: TICK_DT,
    statusDefinition: (statusId) => DEFINITIONS.get(statusId),
  });
}

describe("continuous movement speed", () => {
  it.each([
    ["slowed", 6],
    ["wet", 8.5],
    ["oiled", 6],
  ])("resolves the authored %s modifier", (statusId, expectedSpeed) => {
    expect(resolve([active(statusId)])).toBeCloseTo(expectedSpeed);
  });

  it("composes concurrent and future stacked modifiers without status-specific code", () => {
    expect(resolve([
      active("slowed"),
      active("wet"),
      active("future-haste", 2),
    ])).toBeCloseTo(10 * 0.6 * 0.85 * 1.1 * 1.1);
  });

  it("ignores statuses without continuous speed primitives", () => {
    expect(resolve([active("unknown-status")])).toBe(10);
  });

  it("keeps baseline speed constant when no modifiers are active", () => {
    expect(project(10, [], 3)).toEqual([10, 10, 10]);
  });

  it("applies the current modifier through the movement tick that expires it", () => {
    expect(project(6, [snapshot("slowed", TICK_DT)], 3)).toEqual([6, 10, 10]);
  });

  it("resolves multiple modifiers as each timer expires", () => {
    expect(project(10 * 0.6 * 0.85, [
      snapshot("slowed", TICK_DT),
      snapshot("wet", TICK_DT * 2),
    ], 3)).toEqual([5.1, 8.5, 10]);
  });
});
