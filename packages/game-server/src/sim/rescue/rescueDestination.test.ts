import { describe, expect, it } from "vitest";
import { findRescueDestination } from "./rescueDestination.js";
import { RescueTestWorld } from "./rescueTestSupport.js";

describe("rescue destination search", () => {
  it("chooses the nearest centered flat 3×3 floor", () => {
    const world = new RescueTestWorld();
    world.addPlatform(8, 0, 2);
    world.addPlatform(4, 0, -2);

    expect(search(world, { x: 0.25, y: 0.25 })).toEqual({
      x: 4.5,
      y: 0.5,
      z: -2,
    });
  });

  it("measures nearest from the player's exact position, not its tile origin", () => {
    const world = new RescueTestWorld();
    world.addPlatform(-4, 0);
    world.addPlatform(4, 0);

    expect(search(world, { x: 0.9, y: 0.5 })).toMatchObject({
      x: 4.5,
      y: 0.5,
    });
  });

  it("rejects obstructed and uneven 3×3 platforms", () => {
    const obstructed = new RescueTestWorld();
    obstructed.addPlatform(4, 0);
    obstructed.block(4, 0);
    expect(search(obstructed, { x: 0, y: 0 })).toBeNull();

    const uneven = new RescueTestWorld();
    uneven.addPlatform(4, 0);
    uneven.setFloor(5, 1, 1);
    expect(search(uneven, { x: 0, y: 0 })).toBeNull();
  });

  it("leaves the current walkable component instead of teleporting in place", () => {
    const world = new RescueTestWorld();
    world.addPlatform(0, 0);
    world.addPlatform(8, 0);

    expect(search(world, { x: 0.5, y: 0.5 })).toEqual({
      x: 8.5,
      y: 0.5,
      z: 0,
    });
  });

  it("rejects disallowed and dynamically occupied platform footprints", () => {
    const world = new RescueTestWorld();
    world.addPlatform(4, 0);
    world.addPlatform(8, 0);

    expect(findRescueDestination({
      world,
      from: { x: 0.5, y: 0.5 },
      allowsTile: (x) => x >= 7,
      isOccupied: (x, y) => x === 8 && y === 0,
    })).toBeNull();
  });
});

function search(
  world: RescueTestWorld,
  from: { readonly x: number; readonly y: number },
) {
  return findRescueDestination({
    world,
    from,
    allowsTile: () => true,
    isOccupied: () => false,
  });
}
