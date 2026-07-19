import { describe, expect, it } from "vitest";
import type { WorldView } from "../world/types.js";
import { makeEntity } from "./entity.js";
import { createBody } from "./movement/index.js";
import { stepProjectile } from "./projectile.js";

/** A raised tile at (1, 0): plain terrain, walkable at any height (own-tile face model — collision is height, not a separate facade). */
function raisedTileWorld(): WorldView {
  return {
    isWalkable: () => true,
    heightAt: (x, y) => (x === 1 && y === 0 ? 2 : 0),
    groundAt: (x, y) => (Math.floor(x) === 1 && Math.floor(y) === 0 ? 2 : 0),
  };
}

/** A solid (furniture) tile at (1, 0): blocks regardless of height. */
function solidTileWorld(): WorldView {
  return {
    isWalkable: (x, y) => !(x === 1 && y === 0),
    heightAt: () => 0,
    groundAt: () => 0,
  };
}

function projectile(z: number) {
  const body = createBody(0.5, 0.5, z);
  body.grounded = false;
  return makeEntity("projectile", body, { vel: { x: 10, y: 0, z: 0 } });
}

describe("projectile collision", () => {
  it("stops a low projectile against raised terrain", () => {
    const entity = projectile(1);
    expect(stepProjectile(raisedTileWorld(), entity, 0.1).impact).toEqual({ x: 1.5, y: 0.5 });
  });

  it("allows a projectile above the raised terrain's height to pass", () => {
    const entity = projectile(3);
    expect(stepProjectile(raisedTileWorld(), entity, 0.1).impact).toBeUndefined();
    expect(entity.body.x).toBe(1.5);
  });

  it("stops a projectile at a non-walkable (solid) tile regardless of height", () => {
    const entity = projectile(5);
    expect(stepProjectile(solidTileWorld(), entity, 0.1).impact).toEqual({ x: 0.5, y: 0.5 });
  });
});
