import { describe, expect, it } from "vitest";
import { MOVE_SPEED, STEP_UP, TICK_DT } from "../core/constants";
import type { WorldView } from "../world/types";
import { NEUTRAL_INPUT, createBody, stepBody, type StepResult } from "./movement";

/** Flat test world with a wall column and a height function. */
function fakeWorld(opts: {
  walls?: Array<[number, number]>;
  heightFn?: (x: number, y: number) => number;
  /** Continuous ground override (stair ramps); defaults to tile height. */
  groundFn?: (x: number, y: number) => number;
}): WorldView {
  const walls = new Set((opts.walls ?? []).map(([x, y]) => `${x},${y}`));
  const heightAt = (x: number, y: number): number =>
    opts.heightFn ? opts.heightFn(x, y) : 0;
  return {
    isWalkable: (x, y) => !walls.has(`${x},${y}`),
    heightAt,
    groundAt: (x, y) =>
      opts.groundFn ? opts.groundFn(x, y) : heightAt(Math.floor(x), Math.floor(y)),
  };
}

function runTicks(
  world: WorldView,
  body: ReturnType<typeof createBody>,
  input: Parameters<typeof stepBody>[2],
  ticks: number,
): StepResult[] {
  const results: StepResult[] = [];
  for (let i = 0; i < ticks; i++) results.push(stepBody(world, body, input, TICK_DT));
  return results;
}

describe("movement", () => {
  it("walks at MOVE_SPEED on flat ground", () => {
    const world = fakeWorld({});
    const body = createBody(5.5, 5.5, 0);
    runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 20); // 1 second
    expect(body.x).toBeCloseTo(5.5 + MOVE_SPEED, 5);
    expect(body.y).toBeCloseTo(5.5, 5);
    expect(body.grounded).toBe(true);
  });

  it("is deterministic — identical inputs give identical trajectories", () => {
    const world = fakeWorld({ heightFn: (x) => (x > 8 ? 0.8 : 0) });
    const a = createBody(5.5, 5.5, 0);
    const b = createBody(5.5, 5.5, 0);
    const inputs = [
      { moveX: 1 as const, moveY: 0 as const, jump: false },
      { moveX: 1 as const, moveY: 1 as const, jump: true },
      { moveX: 0 as const, moveY: 1 as const, jump: false },
    ];
    for (let i = 0; i < 60; i++) {
      const input = inputs[i % inputs.length]!;
      stepBody(world, a, input, TICK_DT);
      stepBody(world, b, input, TICK_DT);
    }
    expect(a).toEqual(b);
  });

  it("walls block movement", () => {
    const world = fakeWorld({ walls: [[6, 5]] });
    const body = createBody(5.5, 5.5, 0);
    runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 40);
    expect(body.x).toBeLessThan(6); // never entered the wall tile
  });

  it("steps up terrain within STEP_UP but is blocked by cliffs", () => {
    const step = fakeWorld({ heightFn: (x) => (x >= 8 ? STEP_UP : 0) });
    const stepper = createBody(7.5, 5.5, 0);
    runTicks(step, stepper, { moveX: 1, moveY: 0, jump: false }, 10);
    expect(stepper.x).toBeGreaterThan(8);
    expect(stepper.z).toBeCloseTo(STEP_UP, 5);

    const cliff = fakeWorld({ heightFn: (x) => (x >= 8 ? 3 : 0) });
    const blocked = createBody(7.5, 5.5, 0);
    runTicks(cliff, blocked, { moveX: 1, moveY: 0, jump: false }, 40);
    expect(blocked.x).toBeLessThan(8);
    expect(blocked.z).toBe(0);
  });

  it("jumping clears a 2-high ledge", () => {
    const world = fakeWorld({ heightFn: (x) => (x >= 8 ? 2 : 0) });
    const body = createBody(7.4, 5.5, 0);
    // Jump, then keep pushing toward the ledge.
    stepBody(world, body, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 30);
    expect(body.x).toBeGreaterThan(8);
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(2, 5);
  });

  it("walking off a ledge falls and reports fall height on landing", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 5 : 0) });
    const body = createBody(7.5, 5.5, 5);
    const results = runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 40);
    const landing = results.find((r) => r.landed);
    expect(landing).toBeDefined();
    expect(landing!.landed!.fallHeight).toBeCloseTo(5, 1);
    expect(body.grounded).toBe(true);
    expect(body.z).toBe(0);
  });

  it("allows a brief coyote jump after stepping off a ledge", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 2 : 0) });
    const body = createBody(7.5, 5.5, 2);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(body.grounded).toBe(false);
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    expect(body.zVel).toBeGreaterThan(0);
    expect(body.z).toBeGreaterThan(2);
  });

  it("does not allow a jump after the coyote window expires", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 2 : 0) });
    const body = createBody(7.5, 5.5, 2);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    expect(body.zVel).toBeLessThanOrEqual(0);
  });

  it("gravity applies even with neutral input (server coasting)", () => {
    const world = fakeWorld({ heightFn: () => 0 });
    const body = createBody(5.5, 5.5, 0);
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    expect(body.grounded).toBe(false);
    let ticks = 0;
    while (!body.grounded && ticks < 100) {
      stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
      ticks++;
    }
    expect(body.grounded).toBe(true);
    expect(ticks).toBeLessThan(40); // lands well under two seconds
  });
});
