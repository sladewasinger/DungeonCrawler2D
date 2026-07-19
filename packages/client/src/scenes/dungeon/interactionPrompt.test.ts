import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveInteractionPrompt, type PromptWorld } from "./interactionPrompt.js";

function worldWithTileAt(tx: number, ty: number, tile: TileType): PromptWorld {
  return { tileAt: (wx, wy) => (wx === tx && wy === ty ? tile : TILE.Floor) };
}

describe("resolveInteractionPrompt", () => {
  it("returns null with nothing nearby", () => {
    const world = worldWithTileAt(99, 99, TILE.CraftingTable);
    expect(resolveInteractionPrompt(world, 5, 5, [])).toBeNull();
  });

  it("prompts interact near a crafting table", () => {
    const world = worldWithTileAt(5, 5, TILE.CraftingTable);
    expect(resolveInteractionPrompt(world, 5.4, 5.4, [])).toEqual({ key: "E", label: "interact" });
  });

  it("prompts interact near a door tile", () => {
    const world = worldWithTileAt(5, 5, TILE.DoorSafeRoom);
    expect(resolveInteractionPrompt(world, 5.5, 4.9, [])).toEqual({ key: "E", label: "interact" });
  });

  it("prompts pickup near a ground item when no interactable is in range", () => {
    const world = worldWithTileAt(99, 99, TILE.CraftingTable);
    expect(resolveInteractionPrompt(world, 5, 5, [{ x: 5.3, y: 5 }])).toEqual({ key: "R", label: "pick up" });
  });

  it("prefers interact over pickup when both are in range", () => {
    const world = worldWithTileAt(5, 5, TILE.Stash);
    expect(resolveInteractionPrompt(world, 5.4, 5.4, [{ x: 5.4, y: 5.4 }])).toEqual({ key: "E", label: "interact" });
  });

  it("does not prompt for a tile out of range", () => {
    const world = worldWithTileAt(5, 5, TILE.CraftingTable);
    expect(resolveInteractionPrompt(world, 9, 9, [])).toBeNull();
  });
});
