import { stairwayDownPosition, TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveInteractionPrompt, type PromptWorld } from "./interactionPrompt.js";

/** worldSeed 1 / floor 1's StairwayDown lands at (93, 53) — far from every tile-based
 * test's probe coordinates below, so none of them accidentally cross into its range. */
function worldWithTileAt(tx: number, ty: number, tile: TileType): PromptWorld {
  return {
    worldSeed: 1,
    floor: 1,
    downStairwayPositions: () => [stairwayDownPosition({ worldSeed: 1, floor: 1 })!],
    tileAt: (wx, wy) => (wx === tx && wy === ty ? tile : TILE.Floor),
  };
}

describe("resolveInteractionPrompt", () => {
  it("shows named death loot after stairs and revive but before ordinary pickups", () => {
    const world = worldWithTileAt(5, 5, TILE.Floor);
    expect(resolveInteractionPrompt({
      world, x: 5.5, y: 5.5, items: [{ x: 5.5, y: 5.5 }],
      lootChest: { id: "loot", lootOwnerName: "Crawler 123" },
    })).toEqual({ key: "E", label: "open [DEAD] Crawler 123's loot" });
  });

  it("returns null with nothing nearby", () => {
    const world = worldWithTileAt(99, 99, TILE.CraftingTable);
    expect(resolveInteractionPrompt({ world, x: 5, y: 5, items: [] })).toBeNull();
  });

  it("prompts craft near a crafting table", () => {
    const world = worldWithTileAt(5, 5, TILE.CraftingTable);
    expect(resolveInteractionPrompt({ world, x: 5.4, y: 5.4, items: [] })).toEqual({ key: "E", label: "craft" });
  });

  it("prompts enter near a door tile", () => {
    const world = worldWithTileAt(5, 5, TILE.DoorSafeRoom);
    expect(resolveInteractionPrompt({ world, x: 5.5, y: 4.9, items: [] })).toEqual({ key: "E", label: "enter" });
  });

  it("prompts entry near an ordinary mini-boss arena gate", () => {
    const world = worldWithTileAt(5, 5, TILE.ArenaGate);
    expect(resolveInteractionPrompt({
      world,
      x: 5.5,
      y: 5.5,
      items: [],
    })).toEqual({ key: "E", label: "enter mini-boss arena" });
  });

  it("prompts pickup near a ground item when no interactable is in range", () => {
    const world = worldWithTileAt(99, 99, TILE.CraftingTable);
    expect(resolveInteractionPrompt({ world, x: 5, y: 5, items: [{ x: 5.3, y: 5 }] })).toEqual({ key: "R", label: "pick up" });
  });

  it("prefers interact over pickup when both are in range", () => {
    const world = worldWithTileAt(5, 5, TILE.Stash);
    expect(resolveInteractionPrompt({ world, x: 5.4, y: 5.4, items: [{ x: 5.4, y: 5.4 }] })).toEqual({
      key: "E",
      label: "open stash",
    });
  });

  it("does not prompt for a tile out of range", () => {
    const world = worldWithTileAt(5, 5, TILE.CraftingTable);
    expect(resolveInteractionPrompt({ world, x: 9, y: 9, items: [] })).toBeNull();
  });

  it("prompts to descend at a real StairwayDown position, ahead of an incidental interact tile", () => {
    const world = worldWithTileAt(93, 53, TILE.CraftingTable);
    const target = stairwayDownPosition(world);
    expect(resolveInteractionPrompt({ world, x: target!.x, y: target!.y, items: [] })).toEqual({
      key: "E",
      label: "Descend to Floor 2",
    });
  });

  it("prompts a revive ahead of terrain interaction and pickup", () => {
    const world = worldWithTileAt(5, 5, TILE.Stash);
    expect(resolveInteractionPrompt({ world, x: 5.4, y: 5.4, items: [{ x: 5.4, y: 5.4 }], reviveTarget: { id: "ally" } })).toEqual({
      key: "E",
      label: "hold to revive",
    });
  });

  it("prompts to adopt an unclaimed pet", () => {
    const world = worldWithTileAt(99, 99, TILE.CraftingTable);
    expect(resolveInteractionPrompt({
      world, x: 5, y: 5, items: [], pet: { x: 5.5, y: 5, name: "Doux" },
    })).toEqual({ key: "E", label: "adopt Doux" });
  });

});
