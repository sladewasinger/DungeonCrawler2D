import { describe, expect, it } from "vitest";
import {
  MOVE_SPEED,
  RUN_SPEED_MULTIPLIER,
  STEP_UP,
  TICK_DT,
} from "../../../core/constants.js";
import type { WorldView } from "../../../world/core/types.js";
import { NEUTRAL_INPUT, createBody, stepBody, type StepResult } from "../../../index.js";

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
    stairHeightAt: () => null,
  };
}

function runTicks(...[world, body, input, ticks]: [WorldView, ReturnType<typeof createBody>, Parameters<typeof stepBody>[2], number]): StepResult[] {
  const results: StepResult[] = [];
  for (let i = 0; i < ticks; i++) results.push(stepBody(world, body, input, TICK_DT));
  return results;
}

function advanceUntilGrounded({ world, body, input, height, budget }: { world: WorldView; body: ReturnType<typeof createBody>; input: Parameters<typeof stepBody>[2]; height: number; budget: number }): void {
  for (let tick = 0; tick < budget; tick++) {
    if (body.grounded && body.z === height) return;
    stepBody(world, body, input, TICK_DT);
  }
}

function steppedHeight(progress: number): number {
  if (progress >= 11) return 2;
  return progress >= 8 ? 1 : 0;
}

function assertCardinalChain({ dx, dy }: { dx: number; dy: number }): void {
  const progress = (x: number, y: number): number => dx ? x * dx : y * dy;
  const world = fakeWorld({ heightFn: (x, y) => steppedHeight(progress(x, y)), groundFn: (x, y) => steppedHeight(progress(x, y)) });
  const body = createBody(dx * 7.2 || 5.5, dy * 7.2 || 5.5, 0);
  const move = { moveX: dx, moveY: dy, jump: false };
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  advanceUntilGrounded({ world, body, input: move, height: 1, budget: 20 });
  expect(body).toMatchObject({ grounded: true, z: 1 });
  stepBody(world, body, move, TICK_DT);
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  advanceUntilGrounded({ world, body, input: move, height: 2, budget: 24 });
  expect(body).toMatchObject({ grounded: true, z: 2 });
}

function assertDiagonalChain(): void {
  const heightAt = (x: number, y: number): number => x >= 11 && y >= 11 ? 2 : x >= 8 && y >= 8 ? 1 : 0;
  const world = fakeWorld({ heightFn: heightAt, groundFn: heightAt });
  const body = createBody(7.2, 7.2, 0);
  const move = { moveX: 1, moveY: 1, jump: false };
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  advanceUntilGrounded({ world, body, input: move, height: 1, budget: 28 });
  expect(body.z).toBe(1);
  stepBody(world, body, move, TICK_DT);
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  advanceUntilGrounded({ world, body, input: move, height: 2, budget: 32 });
  expect(body.z).toBe(2);
}

describe("movement", () => {
  it("input.run scales speed by RUN_SPEED_MULTIPLIER, on top of a caller-supplied opts.speed", () => {
    const world = fakeWorld({});
    const body = createBody(5.5, 5.5, 0);
    runTicks(world, body, { moveX: 1, moveY: 0, jump: false, run: true }, 20); // 1 second
    expect(body.x).toBeCloseTo(5.5 + MOVE_SPEED * RUN_SPEED_MULTIPLIER, 5);

    const customSpeedBody = createBody(5.5, 5.5, 0);
    for (let i = 0; i < 20; i++) {
      stepBody(world, customSpeedBody, { moveX: 1, moveY: 0, jump: false, run: true }, TICK_DT, { speed: 4 });
    }
    expect(customSpeedBody.x).toBeCloseTo(5.5 + 4 * RUN_SPEED_MULTIPLIER, 5);
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
      const input = inputs[i % inputs.length] ?? NEUTRAL_INPUT;
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

  it("bypasses walls only when the authoritative noclip option is present", () => {
    const world = fakeWorld({ walls: [[6, 5]] });
    const body = createBody(5.5, 5.5, 0);
    for (let i = 0; i < 10; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT, { speed: 25, noclip: true });
    }
    expect(body.x).toBeGreaterThan(6);
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

  it("jumping clears a 1-high ledge", () => {
    const world = fakeWorld({ heightFn: (x) => (x >= 8 ? 1 : 0) });
    const body = createBody(7.4, 5.5, 0);
    // Jump, then keep pushing toward the ledge.
    stepBody(world, body, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 30);
    expect(body.x).toBeGreaterThan(8);
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(1, 5);
  });

  it.each([
    { direction: "east", dx: 1, dy: 0 }, { direction: "west", dx: -1, dy: 0 },
    { direction: "south", dx: 0, dy: 1 }, { direction: "north", dx: 0, dy: -1 },
  ])("reliably chains h0→h1→h2 when approaching $direction", ({ dx, dy }) => {
    assertCardinalChain({ dx, dy });
  });

  it("chains diagonal platform corners without bypassing a too-tall rise", () => {
    assertDiagonalChain();

    const tooTall = fakeWorld({ heightFn: (x) => (x >= 8 ? 3 : 0) });
    const blocked = createBody(7.2, 5.5, 0);
    stepBody(tooTall, blocked, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    runTicks(tooTall, blocked, { moveX: 1, moveY: 0, jump: false }, 40);
    expect(blocked.x).toBeLessThan(8);
    expect(blocked.z).toBe(0);
  });

});
