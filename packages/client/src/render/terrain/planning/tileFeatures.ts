import { TILE } from "@dc2d/engine";

const DOOR_TILES: readonly number[] = [TILE.DoorPersonal, TILE.DoorParty, TILE.DoorExit, TILE.DoorSafeRoom];

export function terrainFeatureForTile(tile: number): "stairs" | "door" | "brazier" | null {
  if (tile === TILE.Stairs) return "stairs";
  if (DOOR_TILES.includes(tile)) return "door";
  return null;
}

export function terrainFeatureAt(
  world: { featureAt(x: number, y: number): number },
  x: number,
  y: number,
): ReturnType<typeof terrainFeatureForTile> {
  return terrainFeatureForTile(world.featureAt(x, y));
}

export function terrainPropForTile(
  tile: number,
): "arena-gate" | "crafting-table" | "stash" | null {
  if (tile === TILE.ArenaGate) return "arena-gate";
  if (tile === TILE.CraftingTable) return "crafting-table";
  if (tile === TILE.Stash) return "stash";
  return null;
}
