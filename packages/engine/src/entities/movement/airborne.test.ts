import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import { NEUTRAL_INPUT, createBody, stepBody } from "./index.js";

function flatWorld(heightAt: (x: number) => number = () => 0): WorldView {
  return { isWalkable: () => true, heightAt: (x) => heightAt(x), groundAt: (x) => heightAt(Math.floor(x)), stairHeightAt: () => null };
}

function stepOff(world: WorldView, body: ReturnType<typeof createBody>): void {
  stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
  stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
}

describe("airborne movement", () => {
  it("buffers a jump pressed just before landing", () => {
    const body = createBody(5.5, 5.5, 0.15);
    body.grounded = false;
    body.zVel = -1;
    stepBody(flatWorld(), body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    stepBody(flatWorld(), body, NEUTRAL_INPUT, TICK_DT);
    expect(body.grounded).toBe(true);
    stepBody(flatWorld(), body, NEUTRAL_INPUT, TICK_DT);
    expect(body).toMatchObject({ grounded: false });
    expect(body.zVel).toBeGreaterThan(0);
  });

  it("reports fall height after stepping off a ledge", () => {
    const world = flatWorld((x) => x < 8 ? 5 : 0);
    const body = createBody(7.5, 5.5, 5);
    const results = Array.from({ length: 40 }, () => stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT));
    expect(results.find((result) => result.landed)?.landed?.fallHeight).toBeCloseTo(5, 1);
    expect(body).toMatchObject({ grounded: true, z: 0 });
  });

  it("allows a coyote jump but not one after its window", () => {
    const body = createBody(7.5, 5.5, 2);
    const world = flatWorld((x) => x < 8 ? 2 : 0);
    stepOff(world, body);
    expect(body.grounded).toBe(false);
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    expect(body.zVel).toBeGreaterThan(0);
    const expired = createBody(7.5, 5.5, 2);
    stepOff(world, expired);
    stepBody(world, expired, NEUTRAL_INPUT, TICK_DT);
    stepBody(world, expired, NEUTRAL_INPUT, TICK_DT);
    stepBody(world, expired, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    expect(expired.zVel).toBeLessThanOrEqual(0);
  });

  it("applies gravity with neutral input", () => {
    const body = createBody(5.5, 5.5, 0);
    const world = flatWorld();
    stepBody(world, body, { moveX: 0, moveY: 0, jump: true }, TICK_DT);
    let ticks = 0;
    while (!body.grounded && ticks < 100) { stepBody(world, body, NEUTRAL_INPUT, TICK_DT); ticks++; }
    expect(body.grounded).toBe(true);
    expect(ticks).toBeLessThan(40);
  });
});
