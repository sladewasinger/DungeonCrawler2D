import type { WorldView } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import { worldTileToView } from "../../../view/transform/viewTransform.js";
import { TOON_LIGHTING_TUNING } from "../toonLightingTuning.js";

export interface ToonMaskRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ToonMaskTile {
  readonly viewX: number;
  readonly topY: number;
  readonly height: number;
}

export function toonMaskTileFor(input: {
  readonly world: Pick<WorldView, "groundAt">;
  readonly x: number;
  readonly y: number;
  readonly orientation: ViewOrientation;
}): ToonMaskTile {
  const view = worldTileToView({ x: input.x, y: input.y }, input.orientation);
  const height = input.world.groundAt(input.x + 0.5, input.y + 0.5);
  const projectedFaceHeight = Math.max(0, height);
  return {
    viewX: view.x * SCREEN_TILE_PX,
    topY: (view.y - height) * SCREEN_TILE_PX,
    height: (1 + projectedFaceHeight +
      TOON_LIGHTING_TUNING.maskProjectionPaddingTiles)
      * SCREEN_TILE_PX,
  };
}

export function mergeToonMaskTiles(
  tiles: readonly ToonMaskTile[],
): ToonMaskRect[] {
  const rows = new Map<string, ToonMaskTile[]>();
  for (const tile of tiles) appendMaskTileRow(rows, tile);
  return [...rows.values()].flatMap(mergeMaskRow);
}

function appendMaskTileRow(
  rows: Map<string, ToonMaskTile[]>,
  tile: ToonMaskTile,
): void {
  const key = `${tile.topY}:${tile.height}`;
  const row = rows.get(key) ?? [];
  row.push(tile);
  if (!rows.has(key)) rows.set(key, row);
}

function mergeMaskRow(row: readonly ToonMaskTile[]): ToonMaskRect[] {
  const sorted = [...row].sort((left, right) => left.viewX - right.viewX);
  const rects: ToonMaskRect[] = [];
  for (const tile of sorted) appendMergedMaskRect(rects, tile);
  return rects;
}

function appendMergedMaskRect(
  rects: ToonMaskRect[],
  tile: ToonMaskTile,
): void {
  const previous = rects.at(-1);
  if (previous && previous.x + previous.width === tile.viewX) {
    rects[rects.length - 1] = {
      ...previous,
      width: previous.width + SCREEN_TILE_PX,
    };
    return;
  }
  rects.push({
    x: tile.viewX,
    y: tile.topY,
    width: SCREEN_TILE_PX,
    height: tile.height,
  });
}
