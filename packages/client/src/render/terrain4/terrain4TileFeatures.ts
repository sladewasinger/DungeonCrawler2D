import { TILE } from "@dc2d/engine";

const DOOR_TILES: readonly number[] = [TILE.DoorPersonal, TILE.DoorParty, TILE.DoorExit, TILE.DoorSafeRoom];

export function terrain4FeatureForTile(tile: number): "stairs" | "door" | "brazier" | null {
  if (tile === TILE.Stairs) return "stairs";
  if (DOOR_TILES.includes(tile)) return "door";
  return null;
}

export function terrain4PropForTile(tile: number): "crafting-table" | "stash" | null {
  if (tile === TILE.CraftingTable) return "crafting-table";
  if (tile === TILE.Stash) return "stash";
  return null;
}
