// Door/kiosk tiles double as teal light sources — "portal/kiosk teal glow" per
// VISUAL_DIRECTION. One light per door tile; doors are sparse, so no hash-spacing needed.
import {
  FEATURE_FACE,
  TILE,
  featureAnchor,
  type FeatureFace,
  type TileType,
} from "@dc2d/engine";
import type { TilePos, TileRect } from "./torchPlacement.js";

const DOOR_TILES: ReadonlySet<TileType> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

export interface DoorTileRead {
  featureAt(wx: number, wy: number): TileType;
  featureFaceAt(wx: number, wy: number): FeatureFace;
  featureHeightAt(wx: number, wy: number): number;
}

export interface DoorLightMount extends TilePos {
  readonly x: number;
  readonly y: number;
  readonly projectionHeight: number;
}

/** Every door tile in [x0,x1) x [y0,y1) — each becomes a teal portal light. */
export function doorLightPositions(world: DoorTileRead, bounds: TileRect): DoorLightMount[] {
  const out: DoorLightMount[] = [];
  for (let wy = bounds.y0; wy < bounds.y1; wy++) {
    for (let wx = bounds.x0; wx < bounds.x1; wx++) {
      appendDoorLight({ world, positions: out, tile: { wx, wy } });
    }
  }
  return out;
}

function appendDoorLight(input: DoorLightCandidate): void {
  const { world, tile, positions } = input;
  if (!DOOR_TILES.has(world.featureAt(tile.wx, tile.wy))) return;
  const face = world.featureFaceAt(tile.wx, tile.wy);
  const anchor = featureAnchor({ x: tile.wx, y: tile.wy }, face);
  const featureHeight = world.featureHeightAt(tile.wx, tile.wy);
  positions.push({
    ...tile,
    ...anchor,
    projectionHeight: face === FEATURE_FACE.Top
      ? featureHeight
      : Math.max(0, featureHeight - 0.5),
  });
}

interface DoorLightCandidate {
  readonly world: DoorTileRead;
  readonly positions: DoorLightMount[];
  readonly tile: TilePos;
}
