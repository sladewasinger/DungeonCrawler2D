import {
  createBody,
  makeEntity,
  type WorldView,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { withPursuitJump } from "../ai/enemyPursuit.js";

function flatWorld(targetHeight: number): WorldView {
  const height = (x: number) => Math.floor(x) === 1 ? targetHeight : 0;
  return {
    isWalkable: () => true,
    heightAt: height,
    groundAt: height,
    stairHeightAt: () => null,
  };
}

function pursuit(targetHeight: number) {
  const enemy = makeEntity("enemy", createBody(0.5, 0.5, 0));
  const target = makeEntity(
    "player",
    createBody(1.5, 0.5, targetHeight),
  );
  return withPursuitJump({
    world: flatWorld(targetHeight),
    enemy,
    target: target.body,
    move: { moveX: 1, moveY: 0, jump: false },
  });
}

describe("enemy pursuit jumps", () => {
  it("jumps toward a visible platform one level higher", () => {
    expect(pursuit(1).jump).toBe(true);
  });

  it("does not jump while chasing on the same level", () => {
    expect(pursuit(0).jump).toBe(false);
  });

  it("does not mistake half-height stairs for a platform jump", () => {
    expect(pursuit(0.5).jump).toBe(false);
  });

  it("does not attempt an unreachable one-and-a-half-tile jump", () => {
    expect(pursuit(1.5).jump).toBe(false);
  });
});
