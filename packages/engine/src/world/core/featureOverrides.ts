import {
  BEDROCK_MIN_HEIGHT,
  TILE,
  type TileFeatureOverride,
  type TileType,
} from "./types.js";

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
  heightAt: (x: number, y: number) => number,
): Map<string, TileType> {
  assertBedrockOverrideHeights(overrides, heightAt);
  return new Map(overrides.map(({ x, y, tile }) => [`${x},${y}`, tile]));
}

function assertBedrockOverrideHeights(
  overrides: readonly { x: number; y: number; tile: TileType }[],
  heightAt: (x: number, y: number) => number,
): void {
  for (const { x, y, tile } of overrides) {
    if (tile === TILE.Bedrock && heightAt(x, y) < BEDROCK_MIN_HEIGHT) {
      throw new Error(
        `Bedrock override (${x}, ${y}) is below z${BEDROCK_MIN_HEIGHT}`,
      );
    }
  }
}

export function featureFromTile(tile: TileType): TileType {
  if (tile === TILE.Stairs ||
      tile === TILE.ArenaGate ||
      (tile >= TILE.DoorPersonal && tile <= TILE.DoorSafeRoom)) {
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
