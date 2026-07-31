import { describe, expect, it } from "vitest";
import { RESCUE_TUNING } from "./configuration/rescueTuning.js";
import { findRescueDestination } from "./rescueDestination.js";
import { RescueTestWorld } from "./rescueTestSupport.js";

describe("rescue destination search", () => {
  it("chooses the nearest centered flat 3×3 floor in the local area", () => {
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

  it("can bypass the trapping void to a nearby open platform", () => {
    const world = new RescueTestWorld();
    world.addPlatform(4, 0);

    expect(search(world, { x: 0.5, y: 0.5 })).toEqual({
      x: 4.5,
      y: 0.5,
      z: 0,
    });
  });

  it("rejects chasms, sanctuaries, and dynamically occupied footprints", () => {
    const chasm = new RescueTestWorld();
    chasm.addPlatform(4, 0);
    chasm.removeFloor(4, 0);
    expect(search(chasm, { x: 0.5, y: 0.5 })).toBeNull();

    const sanctuary = new RescueTestWorld();
    sanctuary.addPlatform(4, 0);
    sanctuary.setSanctuary(4, 0);
    expect(findRescueDestination({
      world: sanctuary,
      from: { x: 0.5, y: 0.5 },
      allowsTile: (x, y) => !sanctuary.isSanctuary(x, y),
      isOccupied: () => false,
    })).toBeNull();

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

  it("never falls back to a distant platform outside the local bound", () => {
    const world = new RescueTestWorld();
    const distantX = RESCUE_TUNING.destinationSearchRadiusTiles + 3;
    world.addPlatform(distantX, 0);

    expect(search(world, { x: 0.5, y: 0.5 })).toBeNull();
  });
});

function search(
  world: RescueTestWorld,
  from: { readonly x: number; readonly y: number },
) {
  return findRescueDestination({
    world,
    from,
    allowsTile: (x, y) => !world.isSanctuary(x, y),
    isOccupied: () => false,
  });
}
