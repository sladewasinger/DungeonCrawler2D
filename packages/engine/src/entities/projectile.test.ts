import { describe, expect, it } from "vitest";
import type { WorldView } from "../world/types.js";
import { makeEntity } from "./entity.js";
import { createBody } from "./movement/index.js";
import { stepProjectile } from "./projectile.js";

function facadeWorld(): WorldView {
  return {
    isWalkable: (x, y) => !(x === 1 && y === 0),
    heightAt: () => 0,
    groundAt: () => 0,
    wallFaceAt: (x, y) =>
      x === 1 && y === 0 ? { sourceX: 1, sourceY: -1, bottom: 0, top: 2, span: 2 } : null,
  };
}

function projectile(z: number) {
  const body = createBody(0.5, 0.5, z);
  body.grounded = false;
  return makeEntity("projectile", body, { vel: { x: 10, y: 0, z: 0 } });
}

describe("projected wall facade collision", () => {
  it("stops a low projectile at the visible wall", () => {
    const entity = projectile(1);
    expect(stepProjectile(facadeWorld(), entity, 0.1).impact).toEqual({ x: 0.5, y: 0.5 });
  });

  it("allows a projectile above the wall top to pass", () => {
    const entity = projectile(3);
    expect(stepProjectile(facadeWorld(), entity, 0.1).impact).toBeUndefined();
    expect(entity.body.x).toBe(1.5);
  });
});
