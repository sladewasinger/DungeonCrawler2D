// Headless tests for interactable-tile prop overlays — no Phaser involved.
import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { propFrame } from "./propFrame.js";

describe("propFrame", () => {
  it("never handles doors — they are composed structures (structures.ts), not one-cell props", () => {
    for (const door of [TILE.DoorPersonal, TILE.DoorParty, TILE.DoorExit, TILE.DoorSafeRoom]) {
      expect(propFrame(door)).toBeNull();
    }
  });

  it("gives crafting table and stash their own frames, untinted", () => {
    expect(propFrame(TILE.CraftingTable)).toEqual({ frame: "crafting_table" });
    expect(propFrame(TILE.Stash)).toEqual({ frame: "chest_full_open_anim_f0" });
  });

  it("returns null for plain floor/wall/stairs — no prop overlay", () => {
    expect(propFrame(TILE.Floor)).toBeNull();
    expect(propFrame(TILE.Wall)).toBeNull();
    expect(propFrame(TILE.Stairs)).toBeNull();
  });
});
