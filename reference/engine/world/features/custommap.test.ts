import { afterEach, describe, expect, it } from "vitest";
import { hashString } from "../../core/rng";
import { customArt2At, customArtAt, setCustomMap, type CustomMapDef } from "./custommap";
import { TILE } from "../types";
import { World } from "../world";

const SEED = hashString("custom-map-test");

// 6×5 authored room: wall ring, floor interior, a door in the south wall.
const W = TILE.Wall;
const F = TILE.Floor;
const D = TILE.DoorSafeRoom;
const map: CustomMapDef = {
  format: "dc2d-map",
  version: 1,
  tileSize: 16,
  sheet: "walls_floor.png",
  sheetCols: 13,
  origin: { x: 170, y: 170 }, // chunk (5,5), far from the test zone
  width: 6,
  height: 5,
  logic: [
    W, W, W, W, W, W,
    W, F, F, F, F, W,
    W, F, F, F, F, W,
    W, W, D, W, W, W,
    null, null, null, null, null, null,
  ],
  art: Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? 21 : null)),
  flattenTo: 0,
};

afterEach(() => setCustomMap(null));

describe("custom map stamps (Tile Studio import)", () => {
  it("stamps logic tiles and flattens height, deterministically", () => {
    setCustomMap(map);
    const a = new World(SEED, 1);
    expect(a.tileAt(170, 170)).toBe(TILE.Wall);
    expect(a.tileAt(171, 171)).toBe(TILE.Floor);
    expect(a.tileAt(172, 173)).toBe(TILE.DoorSafeRoom);
    expect(a.heightAt(171, 171)).toBe(0);

    const b = new World(SEED, 1);
    const chunkA = a.getChunk(5, 5);
    const chunkB = b.getChunk(5, 5);
    expect(Array.from(chunkA.tiles)).toEqual(Array.from(chunkB.tiles));
    expect(Array.from(chunkA.height)).toEqual(Array.from(chunkB.height));
  });

  it("authored interiors survive pocket sealing even when enclosed", () => {
    setCustomMap(map);
    const world = new World(SEED, 1);
    // The room's interior connects to nothing generated, but it must
    // not be sealed back into wall.
    for (let x = 171; x <= 174; x++) {
      expect(world.tileAt(x, 171)).toBe(TILE.Floor);
      expect(world.tileAt(x, 172)).toBe(TILE.Floor);
    }
  });

  it("null logic keeps generated floor but clears generated walls", () => {
    setCustomMap(map);
    const world = new World(SEED, 1);
    // Bottom row of the stamp is all null → never a wall (canvas cleared).
    for (let x = 170; x <= 175; x++) {
      expect(world.tileAt(x, 174)).not.toBe(TILE.Wall);
    }
  });

  it("exposes art overrides inside the stamp and null outside", () => {
    setCustomMap(map);
    expect(customArtAt(170, 170)).toBe(21); // index 0 → art 21
    expect(customArtAt(171, 170)).toBeNull(); // index 1 → null
    expect(customArtAt(169, 170)).toBeNull(); // outside
    setCustomMap(null);
    expect(customArtAt(170, 170)).toBeNull();
  });

  it("carries an optional second art layer (objects over their ground)", () => {
    // no art2 on the base map → always null
    setCustomMap(map);
    expect(customArt2At(170, 170)).toBeNull();
    // with art2: top-layer indices resolve inside the stamp only
    setCustomMap({
      ...map,
      art2: Array.from({ length: 30 }, (_, i) => (i === 7 ? 300 : null)),
    });
    expect(customArt2At(171, 171)).toBe(300); // index 7 = (1,1)
    expect(customArt2At(170, 170)).toBeNull();
    expect(customArt2At(169, 170)).toBeNull(); // outside
  });

  it("does not disturb the world when no map is set", () => {
    const plain = new World(SEED, 1).getChunk(5, 5);
    setCustomMap(map);
    setCustomMap(null);
    const after = new World(SEED, 1).getChunk(5, 5);
    expect(Array.from(plain.tiles)).toEqual(Array.from(after.tiles));
  });
});
