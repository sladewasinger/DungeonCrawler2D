import { describe, expect, it } from "vitest";
import { TILE } from "../../../core/types.js";
import { finiteFeatureWorldFixture } from "../../fixtures/featureWorldFixture.js";
import {
  spawnRoomExteriorSite,
} from "./spawnRoomExterior.js";

describe("spawn-room exterior", () => {
  it("stamps a finite-mode manor facade with walkable landing tiles", () => {
    const world = finiteFeatureWorldFixture(false);
    const exterior = spawnRoomExteriorSite();
    const door = exterior.door;

    expect(world.featureAt(door.x, door.y)).toBe(TILE.DoorExit);
    expect(world.featureFaceAt(door.x, door.y)).toBe(door.featureFace);
    expect(world.heightAt(door.x, door.y)).toBe(0);
    expect(world.surfaceTileAt(door.x, door.y)).toBe(TILE.Floor);
    expect(world.featureAt(door.x - 1, door.y)).toBe(TILE.BuildingWall);
    expect(world.isWalkable(door.x, door.y)).toBe(false);
    expect(world.isWalkable(door.x - 1, door.y)).toBe(false);

    for (const landing of exterior.landingPositions) {
      expect(world.isWalkable(
        Math.floor(landing.x),
        Math.floor(landing.y),
      )).toBe(true);
      expect(world.groundAt(landing.x, landing.y)).toBe(0);
    }
  });
});
