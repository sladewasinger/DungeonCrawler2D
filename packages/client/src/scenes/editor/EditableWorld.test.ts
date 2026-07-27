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
    world.setCell(5, 5, TILE.Floor, 2);
    world.setCell(5, 4, TILE.Floor, 2);
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
    expect(world.tileAt(-1, 0)).toBe(TILE.Void);
    expect(world.tileAt(0, 25)).toBe(TILE.Void);
    expect(world.isWalkable(-1, 0)).toBe(false);
  });

  it("round-trips through serialize/load", () => {
    const world = new EditableWorld();
    world.setCell(2, 2, TILE.Floor, 3);
    world.setCell(4, 4, TILE.Floor, -1);
    const copy = new EditableWorld();
    copy.load(world.serialize());
    expect(copy.cellAt(2, 2)).toEqual({ tile: TILE.Floor, height: 3 });
    expect(copy.cellAt(4, 4)).toEqual({ tile: TILE.Floor, height: -1 });
  });

  it("stamps and removes torches independently of the tile underneath", () => {
    const world = new EditableWorld();
    world.setCell(7, 7, TILE.Floor, 2);
    world.addTorch(7, 7);
    expect(world.hasTorch(7, 7)).toBe(true);
    expect(world.cellAt(7, 7)).toEqual({ tile: TILE.Floor, height: 2 });
    world.removeTorch(7, 7);
    expect(world.hasTorch(7, 7)).toBe(false);
    expect(world.cellAt(7, 7)).toEqual({ tile: TILE.Floor, height: 2 });
  });

  it("ignores a torch stamp outside the grid", () => {
    const world = new EditableWorld();
    world.addTorch(-1, -1);
    expect(world.torchPositions()).toEqual([]);
  });

  it("round-trips torches through serialize/load (additive map-JSON field)", () => {
    const world = new EditableWorld();
    world.addTorch(3, 9);
    world.addTorch(12, 1);
    const copy = new EditableWorld();
    copy.load(world.serialize());
    expect(copy.torchPositions().sort((a, b) => a.wx - b.wx)).toEqual([
      { wx: 3, wy: 9 },
      { wx: 12, wy: 1 },
    ]);
  });

});

describe("EditableWorld paint-over stacking (explicit-heights reskin)", () => {
  it("stamps a finite floor at the exact height selected by the terrain-debug tool", () => {
    const world = new EditableWorld();
    world.paintFloorHeightAt(6, 6, 4, "floor");
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 4 });
    world.paintFloorHeightAt(6, 6, -1, "floor");
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: -1 });
  });

  it("height brush raises a finite floor +1 per paint", () => {
    const world = new EditableWorld();
    world.paintHeightAt(6, 6);
    world.paintHeightAt(6, 6);
    world.paintHeightAt(6, 6);
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 3 });
  });

  it("floor brush keeps a raised floor walkable at the same height", () => {
    const world = new EditableWorld();
    world.paintHeightAt(6, 6);
    world.paintHeightAt(6, 6);
    world.paintFloorAt(6, 6, "medieval-sewer:1");
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 2 });
    expect(world.isWalkable(6, 6)).toBe(true);
  });

  it("erase lowers a finite floor one height step at a time", () => {
    const world = new EditableWorld();
    world.paintHeightAt(6, 6);
    world.paintHeightAt(6, 6);
    world.paintFloorAt(6, 6, "medieval-sewer:1");
    world.eraseAt(6, 6);
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 1 });
    world.eraseAt(6, 6);
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 0 });
    world.eraseAt(6, 6);
    expect(world.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 0 }); // fully cleared
  });

  it("door brush adds a feature to a raised floor; erase restores the floor", () => {
    const world = new EditableWorld();
    world.paintHeightAt(9, 9);
    world.paintDoorAt(9, 9);
    expect(world.cellAt(9, 9)).toEqual({ tile: TILE.DoorSafeRoom, height: 1 });
    world.eraseAt(9, 9);
    expect(world.cellAt(9, 9)).toEqual({ tile: TILE.Floor, height: 1 });
  });

  it("stairs interpolate a run between flanking anchors — no per-tile authored height", () => {
    // R2-STAIRS-SPEC §2/line54 midpoint contract (1-z per tread): tile k from the low
    // anchor = low + (high−low)·(k−0.5)/stepCount. A VALID run has |high−low| = stepCount,
    // so for a 0→3 climb over 3 treads the tile-CENTER heights are 0.5, 1.5, 2.5.
    // (Values hand-derived from the spec formula, not echoed from the implementation.)
    const world = new EditableWorld();
    world.paintFloorAt(4, 19, "medieval-sewer:0"); // south (downhill) anchor, height 0
    world.paintStairsAt(4, 18, 0); // 0 = north, per StackDir's 0=N/1=E/2=S/3=W
    world.paintStairsAt(4, 17, 0);
    world.paintStairsAt(4, 16, 0);
    for (let i = 0; i < 3; i++) world.paintHeightAt(4, 15);
    world.paintFloorAt(4, 15, "medieval-sewer:0"); // north (uphill) anchor, height 3
    expect(world.cellAt(4, 18)).toEqual({ tile: TILE.Stairs, height: 0.5 }); // k=1: 3·0.5/3
    expect(world.cellAt(4, 17)).toEqual({ tile: TILE.Stairs, height: 1.5 }); // k=2: 3·1.5/3
    expect(world.cellAt(4, 16)).toEqual({ tile: TILE.Stairs, height: 2.5 }); // k=3: 3·2.5/3
  });

  it("a stacked platform survives a v2 serialize/load round-trip (further painting still stacks)", () => {
    const world = new EditableWorld();
    world.paintHeightAt(6, 6);
    world.paintHeightAt(6, 6);
    world.paintFloorAt(6, 6, "dragon-cave:2");
    const copy = new EditableWorld();
    copy.load(world.serialize());
    expect(copy.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 2 });
    copy.paintHeightAt(6, 6); // raises one higher, proving the reload kept the finite floor
    expect(copy.cellAt(6, 6)).toEqual({ tile: TILE.Floor, height: 3 });
  });
});
