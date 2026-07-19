// Single-tile interactable art (crafting table, stash) at natural pack color.
// Doors are NOT here: they are multi-tile composed structures with footprints
// and their own assembly renderer (structures.ts) — never one-cell sprites.
import { TILE, type TileType } from "@dc2d/engine";

export interface PropFrame {
  readonly frame: string;
  readonly tint?: number;
}

/** The overlay sprite for a single-tile interactable (crafting table, stash), or null. */
export function propFrame(tile: TileType): PropFrame | null {
  switch (tile) {
    case TILE.CraftingTable:
      return { frame: "crafting_table" };
    case TILE.Stash:
      return { frame: "chest_full_open_anim_f0" };
    default:
      return null;
  }
}
