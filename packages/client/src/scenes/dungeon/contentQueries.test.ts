import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { categoryOfItem, isTileTypeNearby, isThrowableItem, itemName, nearestEntityId, recipeIdAtIndex } from "./contentQueries.js";

describe("isThrowableItem", () => {
  it("is true for a throwable item like the torch", () => {
    expect(isThrowableItem("torch")).toBe(true);
  });

  it("is false for a non-throwable item and for an unknown id", () => {
    expect(isThrowableItem("bandage")).toBe(false);
    expect(isThrowableItem("nonexistent")).toBe(false);
  });
});

describe("categoryOfItem", () => {
  it("puts weapons in the weapons tab even when they're also throwable (torch)", () => {
    expect(categoryOfItem("sword")).toBe("weapons");
    expect(categoryOfItem("torch")).toBe("weapons");
  });

  it("puts consumables and non-weapon throwables in the usables tab", () => {
    expect(categoryOfItem("bandage")).toBe("usables");
    expect(categoryOfItem("vodka-bottle")).toBe("usables");
  });

  it("falls back to materials for everything else, including unknown ids", () => {
    expect(categoryOfItem("rag")).toBe("materials");
    expect(categoryOfItem("nonexistent")).toBe("materials");
  });
});

describe("itemName", () => {
  it("resolves a known item's display name", () => {
    expect(itemName("sword")).toBe("Rusty Sword");
  });

  it("falls back to the raw id for an unknown item", () => {
    expect(itemName("nonexistent")).toBe("nonexistent");
  });
});

describe("recipeIdAtIndex", () => {
  it("resolves a known recipe index", () => {
    expect(recipeIdAtIndex(0)).toBe("bandage");
  });

  it("returns undefined out of range", () => {
    expect(recipeIdAtIndex(999)).toBeUndefined();
  });
});

describe("nearestEntityId", () => {
  const entities = [
    { id: "a", kind: "player", x: 1, y: 0 },
    { id: "b", kind: "player", x: 5, y: 0 },
    { id: "c", kind: "enemy", x: 0.5, y: 0 },
  ];

  it("finds the nearest entity of the requested kind within range", () => {
    expect(nearestEntityId(entities, "player", 0, 0, 10)).toBe("a");
  });

  it("ignores entities of other kinds", () => {
    expect(nearestEntityId(entities, "enemy", 0, 0, 10)).toBe("c");
  });

  it("returns undefined when nothing is within range", () => {
    expect(nearestEntityId(entities, "player", 0, 0, 0.5)).toBeUndefined();
  });
});

describe("isTileTypeNearby", () => {
  function worldWithTileAt(tx: number, ty: number, tile: TileType) {
    return { tileAt: (wx: number, wy: number) => (wx === tx && wy === ty ? tile : TILE.Floor) };
  }

  it("finds a matching tile in the 3x3 neighborhood", () => {
    const world = worldWithTileAt(4, 4, TILE.Stash);
    expect(isTileTypeNearby(world, TILE.Stash, 5, 5)).toBe(true);
  });

  it("is false when nothing matches nearby", () => {
    const world = worldWithTileAt(99, 99, TILE.Stash);
    expect(isTileTypeNearby(world, TILE.Stash, 5, 5)).toBe(false);
  });
});
