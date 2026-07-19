// The editor world's contract under the own-tile face model: collision is pure
// height + solid furniture, face rows live on the raised cells themselves, the
// void frame surrounds the island, and maps survive a serialize round-trip.
import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { ownFaceRowAt } from "../../render/terrain/ownFace.js";
import { EditableWorld } from "./EditableWorld.js";

describe("EditableWorld", () => {
  it("raised cells ARE their own face rows — the wall starts where it was painted", () => {
    const world = new EditableWorld();
    world.setCell(5, 5, TILE.Wall, 2);
    world.setCell(5, 4, TILE.Wall, 2);
    // The southern painted cell carries the face; the ground south of it stays clear.
    expect(ownFaceRowAt(world, 5, 5)).toMatchObject({ distanceToGround: 1, surfaceHeight: 2 });
    expect(ownFaceRowAt(world, 5, 6)).toBeNull();
    // z2 means a two-row face: the cell above is the face's top row.
    expect(ownFaceRowAt(world, 5, 4)).toMatchObject({ rowFromTop: 1 });
  });

  it("keeps every floor walkable — height blocking is the engine's job, not a tile flag", () => {
    const world = new EditableWorld();
    world.setCell(3, 3, TILE.Floor, 2);
    expect(world.isWalkable(3, 3)).toBe(true);
    expect(world.isWalkable(3, 4)).toBe(true);
    world.setCell(2, 2, TILE.CraftingTable, 0);
    expect(world.isWalkable(2, 2)).toBe(false);
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
