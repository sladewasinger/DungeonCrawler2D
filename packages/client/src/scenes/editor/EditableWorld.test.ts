// The editor world's contract: facade blocking mirrors the engine, the void
// frame surrounds the island, and maps survive a serialize round-trip.
import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { EditableWorld } from "./EditableWorld.js";

describe("EditableWorld", () => {
  it("projects a blocking facade south of a rock cell, but never through a door", () => {
    // z2 clears the facade threshold under both the current and the rescaled
    // engine constants (this suite must stay green across the 1z=1tile rescale).
    const world = new EditableWorld();
    world.setCell(5, 5, TILE.Wall, 2);
    expect(world.wallFaceAt(5, 6)).toMatchObject({ sourceX: 5, sourceY: 5, top: 2 });
    expect(world.isWalkable(5, 6)).toBe(false);
    world.setCell(5, 6, TILE.DoorSafeRoom, 0);
    expect(world.wallFaceAt(5, 6)).toBeNull();
  });

  it("raised floors block sub-facade drops only via height, not facades", () => {
    const world = new EditableWorld();
    world.setCell(3, 3, TILE.Floor, 2);
    expect(world.wallFaceAt(3, 4)).toBeNull();
    expect(world.isWalkable(3, 4)).toBe(true);
  });

  it("outside the grid reads as chasm void", () => {
    const world = new EditableWorld();
    expect(world.heightAt(-1, 0)).toBeLessThan(-2);
    expect(world.heightAt(0, 25)).toBeLessThan(-2);
  });

  it("round-trips through serialize/load", () => {
    const world = new EditableWorld();
    world.setCell(2, 2, TILE.Wall, 3);
    world.setCell(4, 4, TILE.Floor, -1);
    const copy = new EditableWorld();
    copy.load(world.serialize());
    expect(copy.cellAt(2, 2)).toEqual({ tile: TILE.Wall, height: 3 });
    expect(copy.cellAt(4, 4)).toEqual({ tile: TILE.Floor, height: -1 });
  });
});
