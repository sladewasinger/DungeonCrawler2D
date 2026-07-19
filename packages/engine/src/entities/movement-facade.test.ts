import { describe, expect, it } from "vitest";
import { TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { NEUTRAL_INPUT, createBody, stepBody } from "./movement/index.js";

function facadeWorld(withRaisedTop = false): WorldView {
  const heightAt = (_x: number, y: number): number => (withRaisedTop && y <= 6 ? 2 : 0);
  return {
    isWalkable: (x, y) => !(x === 5 && y === 7),
    heightAt,
    groundAt: (x, y) => heightAt(Math.floor(x), Math.floor(y)),
    wallFaceAt: (x, y) =>
      x === 5 && y === 7 ? { sourceX: 5, sourceY: 6, bottom: 0, top: 2 } : null,
  };
}

function walkNorth(world: WorldView, body: ReturnType<typeof createBody>, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
  }
}

describe("projected wall facade movement", () => {
  it("stops grounded feet at the visible base", () => {
    const body = createBody(5.5, 8.5, 0);
    walkNorth(facadeWorld(), body, 20);
    expect(Math.floor(body.y)).toBe(8);
    expect(body.z).toBe(0);
  });

  it("allows a jump over the facade and onto its raised top", () => {
    const world = facadeWorld(true);
    const body = createBody(5.5, 8.5, 0);
    stepBody(world, body, { moveX: 0, moveY: -1, jump: true }, TICK_DT);
    walkNorth(world, body, 30);
    expect(body.y).toBeLessThan(7);
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(2, 5);
  });

  it("ejects a falling body to the base instead of landing inside", () => {
    const body = createBody(5.5, 7.5, 1);
    body.grounded = false;
    body.zVel = -1;
    stepBody(facadeWorld(), body, NEUTRAL_INPUT, TICK_DT);
    expect(Math.floor(body.y)).toBe(8);
  });
});
