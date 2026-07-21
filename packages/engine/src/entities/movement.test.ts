import { describe, expect, it } from "vitest";
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER, STEP_UP, TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { NEUTRAL_INPUT, createBody, stepBody, type StepResult } from "./movement/index.js";

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
    ["east", 1, 0],
    ["west", -1, 0],
    ["south", 0, 1],
    ["north", 0, -1],
  ] as const)("reliably chains h0→h1→h2 when approaching %s", (_name, dirX, dirY) => {
    const progress = (x: number, y: number) => (dirX !== 0 ? x * dirX : y * dirY);
    const world = fakeWorld({
      heightFn: (x, y) => {
        const p = progress(x, y);
        return p >= 11 ? 2 : p >= 8 ? 1 : 0;
      },
      groundFn: (x, y) => {
        const p = progress(x, y);
        return p >= 11 ? 2 : p >= 8 ? 1 : 0;
      },
    });
    const body = createBody(dirX * 7.2 || 5.5, dirY * 7.2 || 5.5, 0);
    const move = { moveX: dirX, moveY: dirY, jump: false };

    stepBody(world, body, { ...move, jump: true }, TICK_DT);
    for (let i = 0; i < 20 && !(body.grounded && body.z === 1); i++) stepBody(world, body, move, TICK_DT);
    expect(body.grounded).toBe(true);
    expect(body.z).toBe(1);

    stepBody(world, body, move, TICK_DT);
    stepBody(world, body, { ...move, jump: true }, TICK_DT);
    for (let i = 0; i < 24 && !(body.grounded && body.z === 2); i++) stepBody(world, body, move, TICK_DT);
    expect(body.grounded).toBe(true);
    expect(body.z).toBe(2);
  });

  it("chains diagonal platform corners without bypassing a too-tall rise", () => {
    const diagonal = fakeWorld({
      heightFn: (x, y) => (x >= 11 && y >= 11 ? 2 : x >= 8 && y >= 8 ? 1 : 0),
      groundFn: (x, y) => (x >= 11 && y >= 11 ? 2 : x >= 8 && y >= 8 ? 1 : 0),
    });
    const body = createBody(7.2, 7.2, 0);
    const move = { moveX: 1, moveY: 1, jump: false };
    stepBody(diagonal, body, { ...move, jump: true }, TICK_DT);
    for (let i = 0; i < 28 && !(body.grounded && body.z === 1); i++) stepBody(diagonal, body, move, TICK_DT);
    expect(body.z).toBe(1);
    stepBody(diagonal, body, move, TICK_DT);
    stepBody(diagonal, body, { ...move, jump: true }, TICK_DT);
    for (let i = 0; i < 32 && !(body.grounded && body.z === 2); i++) stepBody(diagonal, body, move, TICK_DT);
    expect(body.z).toBe(2);

    const tooTall = fakeWorld({ heightFn: (x) => (x >= 8 ? 3 : 0) });
    const blocked = createBody(7.2, 5.5, 0);
    stepBody(tooTall, blocked, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    runTicks(tooTall, blocked, { moveX: 1, moveY: 0, jump: false }, 40);
    expect(blocked.x).toBeLessThan(8);
    expect(blocked.z).toBe(0);
  });

  it("buffers a jump pressed just before landing", () => {
    const world = fakeWorld({});
    const body = createBody(5.5, 5.5, 0.15);
    body.grounded = false;
    body.zVel = -1;
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    expect(body.grounded).toBe(true);
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    expect(body.grounded).toBe(false);
    expect(body.zVel).toBeGreaterThan(0);
  });

  it("walking off a ledge falls and reports fall height on landing", () => {
    const world = fakeWorld({ heightFn: (x) => (x < 8 ? 5 : 0) });
    const body = createBody(7.5, 5.5, 5);
    const results = runTicks(world, body, { moveX: 1, moveY: 0, jump: false }, 40);
    const landing = results.find((r) => r.landed);
    expect(landing).toBeDefined();
    expect(landing?.landed?.fallHeight).toBeCloseTo(5, 1);
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
