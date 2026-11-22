import { TILE, isSpawnRoomExteriorDoor } from "@dc2d/engine";
import { TERRAIN_PROPS, type TerrainPropKind } from "../geometry/terrainPlannerModel.js";

const DOOR_TILES: readonly number[] = [TILE.DoorPersonal, TILE.DoorParty, TILE.DoorExit];

const PROP_BY_TILE: Readonly<Record<number, TerrainPropKind>> = {
  [TILE.ArenaGate]: TERRAIN_PROPS.ArenaGate,
  [TILE.CraftingTable]: TERRAIN_PROPS.CraftingTable,
  [TILE.Stash]: TERRAIN_PROPS.Stash,
  [TILE.DoorSafeRoom]: TERRAIN_PROPS.SafeHouse,
  [TILE.Water]: TERRAIN_PROPS.Water,
  [TILE.Bridge]: TERRAIN_PROPS.Bridge,
  [TILE.Tree]: TERRAIN_PROPS.Tree,
  [TILE.Bush]: TERRAIN_PROPS.Bush,
  [TILE.Boulder]: TERRAIN_PROPS.Boulder,
  [TILE.CampTent]: TERRAIN_PROPS.CampTent,
  [TILE.CampFence]: TERRAIN_PROPS.CampFence,
  [TILE.RuinPillar]: TERRAIN_PROPS.RuinPillar,
};

export function terrainFeatureForTile(tile: number): "stairs" | "door" | "brazier" | null {
  if (tile === TILE.Stairs) return "stairs";
  if (DOOR_TILES.includes(tile)) return "door";
  return null;
}

export function terrainFeatureAt(
  world: { featureAt(x: number, y: number): number; readonly floor?: number },
  x: number,
  y: number,
): ReturnType<typeof terrainFeatureForTile> {
  const tile = world.featureAt(x, y);
  if (isSpawnExteriorPortal({ tile, floor: world.floor, x, y })) return null;
  return terrainFeatureForTile(tile);
}

export function terrainPropAt(
  world: { featureAt(x: number, y: number): number; readonly floor?: number },
  x: number,
  y: number,
): TerrainPropKind | null {
  const tile = world.featureAt(x, y);
  if (isSpawnExteriorPortal({ tile, floor: world.floor, x, y })) return TERRAIN_PROPS.SpawnHouse;
  return terrainPropForTile(tile);
}

export function terrainPropForTile(tile: number): TerrainPropKind | null {
  return PROP_BY_TILE[tile] ?? null;
}

function isSpawnExteriorPortal(input: {
  readonly tile: number;
  readonly floor: number | undefined;
  readonly x: number;
  readonly y: number;
}): boolean {
  return input.tile === TILE.DoorExit &&
    input.floor !== undefined &&
    isSpawnRoomExteriorDoor(input.floor, input.x, input.y);
}
