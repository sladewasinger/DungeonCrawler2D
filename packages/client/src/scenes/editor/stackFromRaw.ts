// EditableWorld's raw (tile, height) -> StackTile bridge — the escape hatch furniture
// stamps and tests use to bypass the paint-over vocabulary entirely.
import { DEFAULT_FLOOR_CAP, TILE, TILE_FEATURE, type StackTile, type TileType } from "@dc2d/engine";

export function stackFromRaw(tile: TileType, height: number): StackTile {
  const feature = TILE_FEATURE.get(tile);
  if (feature) return { height: height, cap: DEFAULT_FLOOR_CAP, stair: null, feature };
  if (tile === TILE.Void) return { height: height, cap: null, stair: null };
  // Stairs have no free-standing height in the new model (compile.ts's run
  // interpolation derives it) — a lone raw stamp is an unresolved dir-0 stub.
  if (tile === TILE.Stairs) return { height: 0, cap: null, stair: { dir: 0 } };
  return { height: height, cap: DEFAULT_FLOOR_CAP, stair: null };
}
