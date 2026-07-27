import { describe, expect, it } from "vitest";
import { INTERACT_RANGE } from "../../core/constants.js";
import { findWorldInteractionTarget, resolveWorldInteraction } from "./interactions.js";
import { TILE, type TileType } from "../core/types.js";

const worldWith = (tiles: ReadonlyMap<string, TileType>) => ({
  tileAt: (x: number, y: number) => tiles.get(`${x},${y}`) ?? TILE.Floor,
});

describe("world interactions", () => {
  it("uses door, stash, craft priority and rejects a 3x3 corner beyond interaction range", () => {
    const world = worldWith(new Map([
      ["5,5", TILE.CraftingTable],
      ["4,5", TILE.Stash],
      ["5,4", TILE.DoorExit],
    ]));
    expect(resolveWorldInteraction(world, 4.5, 4.5)?.kind).toBe("door");
    const cornerOnly = worldWith(new Map([["5,5", TILE.CraftingTable]]));
    expect(resolveWorldInteraction(cornerOnly, 4, 4)).toBeNull();
  });

  it("includes the exact range boundary and resolves same-kind ties deterministically", () => {
    const world = worldWith(new Map([
      ["0,0", TILE.Stash],
      ["2,0", TILE.Stash],
    ]));
    expect(findWorldInteractionTarget({ world, x: 0.5 - INTERACT_RANGE, y: 0.5, kind: "stash" })?.x).toBe(0);
    expect(findWorldInteractionTarget({ world, x: 1.5, y: 0.5, kind: "stash" })?.x).toBe(0);
  });
});
