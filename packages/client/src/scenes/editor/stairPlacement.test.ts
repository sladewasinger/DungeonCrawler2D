import {
  DEFAULT_FLOOR_CAP,
  TILE,
  entryClimbDir,
  stairVisualAt,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { EditableWorld } from "./EditableWorld.js";
import { EditorStore } from "./editorStore.js";
import { paintCell } from "./paintAction.js";
import { planStairPlacement } from "./stairPlacement.js";

const point = (x: number, y: number) => ({ x, y });

describe("planStairPlacement", () => {
  it("defaults an equal-height destination to a one-level climb in the clicked direction", () => {
    const plan = planStairPlacement(
      { inGrid: () => true, heightAt: () => 4 },
      point(5, 5),
      point(6, 5),
    );

    expect(plan).toMatchObject({
      stairDirection: 1,
      originLanding: point(4, 5),
      originHeight: 4,
      destinationHeight: 5,
    });
  });

  it("reverses the climb direction when the clicked destination is lower", () => {
    const plan = planStairPlacement(
      {
        inGrid: () => true,
        heightAt: (x) => x === 6 ? 1 : 3,
      },
      point(5, 5),
      point(6, 5),
    );

    expect(plan).toMatchObject({
      stairDirection: 3,
      originHeight: 3,
      destinationHeight: 2,
    });
  });

  it("rejects diagonal clicks and placements missing either landing", () => {
    const world = {
      inGrid: (x: number, y: number) => x >= 0 && y >= 0 && x < 20 && y < 20,
      heightAt: () => 0,
    };
    expect(planStairPlacement(world, point(5, 5), point(6, 6))).toBeNull();
    expect(planStairPlacement(world, point(0, 5), point(1, 5))).toBeNull();
  });
});

describe("EditableWorld stair transition", () => {
  it("authors one midpoint tread with valid one-level flanking anchors", () => {
    const world = new EditableWorld();
    const plan = world.placeStairTransition(point(5, 5), point(6, 5));

    expect(plan?.stairDirection).toBe(1);
    expect(world.cellAt(4, 5)).toEqual({ tile: TILE.Floor, height: 0 });
    expect(world.cellAt(5, 5)).toEqual({ tile: TILE.Stairs, height: 0.5 });
    expect(world.cellAt(6, 5)).toEqual({ tile: TILE.Floor, height: 1 });
    expect(entryClimbDir(world, 5, 5)).toBe(1);
    expect(stairVisualAt(world, 5, 5)).toMatchObject({ direction: 1 });
  });

  it("persists a descending transition through the editor map format", () => {
    const world = new EditableWorld();
    world.paintFloorHeightAt(5, 5, 3, "dragon-cave:2");
    world.paintFloorHeightAt(6, 5, 1, "medieval-sewer:0");
    const plan = world.placeStairTransition(point(5, 5), point(6, 5));
    const copy = new EditableWorld();
    copy.load(world.serialize());

    expect(plan?.stairDirection).toBe(3);
    expect(copy.cellAt(4, 5)).toEqual({ tile: TILE.Floor, height: 3 });
    expect(copy.cellAt(5, 5)).toEqual({ tile: TILE.Stairs, height: 2.5 });
    expect(copy.cellAt(6, 5)).toEqual({ tile: TILE.Floor, height: 2 });
    expect(entryClimbDir(copy, 5, 5)).toBe(3);
  });
});

describe("EditorStore stair transition", () => {
  it("persists the three-cell mutation as one editor commit", () => {
    let writes = 0;
    const values = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writes++;
        values.set(key, value);
      },
      removeItem: (key) => void values.delete(key),
      clear: () => values.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    const store = new EditorStore();

    store.brush = { kind: "stairs" };
    paintCell(store, 8, 8, false);
    expect(store.pendingStairOrigin).toEqual(point(8, 8));
    paintCell(store, 8, 7, false);
    expect(store.pendingStairOrigin).toBeNull();
    expect(writes).toBe(1);
    expect(JSON.parse(store.exportJson()).stacks[8 * 20 + 8]).toEqual({
      height: 0,
      cap: null,
      stair: { dir: 0 },
    });
    expect(store.world.stackAt(8, 7).cap).toBe(DEFAULT_FLOOR_CAP);
  });

  it("keeps the first selection after an invalid second click", () => {
    localStorage.clear();
    const store = new EditorStore();
    store.brush = { kind: "stairs" };
    paintCell(store, 8, 8, false);
    paintCell(store, 10, 10, false);

    expect(store.pendingStairOrigin).toEqual(point(8, 8));
    expect(store.world.cellAt(8, 8).tile).toBe(TILE.Floor);
  });
});
