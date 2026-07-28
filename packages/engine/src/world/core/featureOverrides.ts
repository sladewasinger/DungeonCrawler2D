import { TILE, type TileFeatureOverride, type TileType } from "./types.js";

export type StoredFeature = Pick<
  TileFeatureOverride,
  "tile" | "featureFace" | "featureHeight"
>;

export function featureOverrideMap(
  overrides: readonly TileFeatureOverride[],
): Map<string, StoredFeature> {
  return new Map(overrides.map(({ x, y, tile, featureFace, featureHeight }) => [
    `${x},${y}`,
    { tile, featureFace, featureHeight },
  ]));
}

export function tileOverrideMap(
  overrides: readonly { x: number; y: number; tile: TileType }[],
): Map<string, TileType> {
  return new Map(overrides.map(({ x, y, tile }) => [`${x},${y}`, tile]));
}

export function featureFromTile(tile: TileType): TileType {
  if (tile === TILE.Stairs || (tile >= TILE.DoorPersonal && tile <= TILE.DoorSafeRoom)) {
    return tile;
  }
  return TILE.Floor;
}

export function sameFeatureOverrides(
  current: ReadonlyMap<string, StoredFeature>,
  next: ReadonlyMap<string, StoredFeature>,
): boolean {
  if (current.size !== next.size) return false;
  for (const [key, feature] of next) {
    const existing = current.get(key);
    if (existing?.tile !== feature.tile ||
        existing.featureFace !== feature.featureFace ||
        existing.featureHeight !== feature.featureHeight) {
      return false;
    }
  }
  return true;
}

export function sameTileOverrides(
  current: ReadonlyMap<string, TileType>,
  next: ReadonlyMap<string, TileType>,
): boolean {
  if (current.size !== next.size) return false;
  for (const [key, tile] of next) if (current.get(key) !== tile) return false;
  return true;
}
