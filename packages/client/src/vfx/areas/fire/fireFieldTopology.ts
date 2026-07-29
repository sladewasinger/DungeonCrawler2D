import type { AreaTileView } from "../areaEffectPool.js";
import type { ViewOrientation } from "../../../render/view/orientation/viewOrientation.js";
import { sameAreaSurfaceHeight } from "../presentation/areaSurface.js";

const CARDINAL_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

export interface FireFieldComponent {
  readonly signature: string;
  readonly tiles: readonly AreaTileView[];
}

export function fireFieldTopologyHash(
  tiles: readonly AreaTileView[],
  orientation: ViewOrientation,
): number {
  let hash = hashText(String(orientation), 0x811c9dc5);
  let count = 0;
  for (const tile of tiles) {
    if (tile.sprite !== "fire") continue;
    hash ^= hashTile(tile);
    count++;
  }
  return Math.imul(hash ^ count, 0x45d9f3b) >>> 0;
}

export function buildFireFieldComponents(
  tiles: readonly AreaTileView[],
  orientation: ViewOrientation,
): FireFieldComponent[] {
  const fireTiles = fireTileMap(tiles);
  const visited = new Set<string>();
  const components: FireFieldComponent[] = [];
  for (const [key, tile] of fireTiles) {
    if (visited.has(key)) continue;
    const componentTiles = collectComponent(tile, fireTiles, visited);
    components.push({
      signature: componentSignature(componentTiles, orientation),
      tiles: componentTiles,
    });
  }
  return components.sort((a, b) => a.signature.localeCompare(b.signature));
}

function fireTileMap(
  tiles: readonly AreaTileView[],
): Map<string, AreaTileView> {
  const result = new Map<string, AreaTileView>();
  for (const tile of tiles) {
    if (tile.sprite === "fire") result.set(tileKey(tile.x, tile.y), tile);
  }
  return result;
}

function collectComponent(
  origin: AreaTileView,
  fireTiles: ReadonlyMap<string, AreaTileView>,
  visited: Set<string>,
): AreaTileView[] {
  const result: AreaTileView[] = [];
  const pending = [origin];
  while (pending.length > 0) {
    const tile = pending.pop();
    if (!tile) continue;
    const key = tileKey(tile.x, tile.y);
    if (visited.has(key)) continue;
    visited.add(key);
    result.push(tile);
    appendNeighbors({ pending, tile, fireTiles, visited });
  }
  return result;
}

function appendNeighbors(
  input: {
    readonly pending: AreaTileView[];
    readonly tile: AreaTileView;
    readonly fireTiles: ReadonlyMap<string, AreaTileView>;
    readonly visited: ReadonlySet<string>;
  },
): void {
  const { pending, tile, fireTiles, visited } = input;
  for (const direction of CARDINAL_DIRECTIONS) {
    const key = tileKey(tile.x + direction.x, tile.y + direction.y);
    const neighbor = fireTiles.get(key);
    if (neighbor && !visited.has(key) && sameAreaSurfaceHeight(
      tile.groundHeight,
      neighbor.groundHeight,
    )) pending.push(neighbor);
  }
}

function componentSignature(
  tiles: readonly AreaTileView[],
  orientation: ViewOrientation,
): string {
  const coordinates = tiles
    .map(({ x, y, groundHeight }) => `${tileKey(x, y)}@${groundHeight}`)
    .sort()
    .join("|");
  return `${orientation}:${coordinates}`;
}

function hashTile(tile: AreaTileView): number {
  let hash = Math.imul(Math.round(tile.x * 2), 0x1f123bb5);
  hash ^= Math.imul(Math.round(tile.y * 2), 0x5f356495);
  hash ^= Math.imul(Math.round(tile.groundHeight * 100), 0x6c8e9cf5);
  return Math.imul(hash ^ tile.neighborMask, 0x45d9f3b) >>> 0;
}

function hashText(value: string, seed: number): number {
  let hash = seed;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}
