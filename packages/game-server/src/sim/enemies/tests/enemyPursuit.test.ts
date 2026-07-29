import {
  createBody,
  makeEntity,
  type WorldView,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { withLedgeTransitionJump } from "../ai/enemyPursuit.js";

function ledgeWorld(platformStart: number, targetHeight: number): WorldView {
  const height = (x: number) =>
    Math.floor(x) >= platformStart ? targetHeight : 0;
  return {
    isWalkable: () => true,
    heightAt: height,
    groundAt: height,
    stairHeightAt: () => null,
  };
}

interface PursuitFixture {
  readonly targetHeight: number;
  readonly platformStart?: number;
  readonly enemyX?: number;
  readonly grounded?: boolean;
}

function pursuit({
  targetHeight,
  platformStart = 1,
  enemyX = 0.5,
  grounded = true,
}: PursuitFixture) {
  const enemy = makeEntity("enemy", createBody(enemyX, 0.5, 0));
  enemy.body.grounded = grounded;
  return withLedgeTransitionJump({
    world: ledgeWorld(platformStart, targetHeight),
    enemy,
    move: { moveX: 1, moveY: 0, jump: false },
  });
}

describe("enemy pursuit jumps", () => {
  it("jumps when the next movement tile is one level higher", () => {
    expect(pursuit({ targetHeight: 1 }).jump).toBe(true);
  });

  it("waits to jump until movement reaches the actual ledge transition", () => {
    expect(pursuit({
      targetHeight: 1,
      platformStart: 2,
    }).jump).toBe(false);
    expect(pursuit({
      targetHeight: 1,
      platformStart: 2,
      enemyX: 1.5,
    }).jump).toBe(true);
  });

  it("does not keep asserting the transition jump while airborne", () => {
    expect(pursuit({
      targetHeight: 1,
      grounded: false,
    }).jump).toBe(false);
  });

  it("does not jump while chasing on the same level", () => {
    expect(pursuit({ targetHeight: 0 }).jump).toBe(false);
  });

  it("does not mistake half-height stairs for a platform jump", () => {
    expect(pursuit({ targetHeight: 0.5 }).jump).toBe(false);
  });

  it("does not attempt an unreachable one-and-a-half-tile jump", () => {
    expect(pursuit({ targetHeight: 1.5 }).jump).toBe(false);
  });
});
