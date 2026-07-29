import { describe, expect, it } from "vitest";
import { hashString } from "../../../../core/rng.js";
import { TILE } from "../../../core/types.js";
import { World } from "../../../core/world.js";
import {
  spawnRoomExteriorSite,
} from "./spawnRoomExterior.js";

describe("spawn-room exterior", () => {
  it("stamps a finite-mode facade with walkable landing tiles", () => {
    const world = new World(hashString("spawn-room-exterior"), 1, {
      features: { voidTerrain: false },
    });
    const exterior = spawnRoomExteriorSite();
    const door = exterior.door;

    expect(world.featureAt(door.x, door.y)).toBe(TILE.DoorExit);
    expect(world.featureFaceAt(door.x, door.y)).toBe(door.featureFace);
    expect(world.heightAt(door.x, door.y)).toBe(3);
    expect(world.surfaceTileAt(door.x, door.y)).toBe(TILE.Bedrock);
    expect(world.isWalkable(door.x, door.y)).toBe(false);

    for (const landing of exterior.landingPositions) {
      expect(world.isWalkable(
        Math.floor(landing.x),
        Math.floor(landing.y),
      )).toBe(true);
      expect(world.groundAt(landing.x, landing.y)).toBe(0);
    }
  });
});
