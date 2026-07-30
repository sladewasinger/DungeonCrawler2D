import {
  hasTerrainLineOfSight,
  type WorldView,
} from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { TOON_LIGHTING_TUNING } from "./toonLightingTuning.js";
import { sweepAngularVisibility } from "./visibility/angularVisibilitySweep.js";
import {
  conservativeToonMaskPaths,
  mergeToonMaskTiles,
  toonMaskTileFor,
  type ToonMaskPath,
  type ToonMaskRect,
  type ToonMaskTile,
} from "./mask/maskGeometry.js";

export interface ToonWorldBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ToonVisibilityWorld extends Pick<WorldView,
  "groundAt" | "heightAt" | "isWalkable" | "stairHeightAt"> {
  readonly tileRevision: number;
}

export interface ToonVisibilityBuildInput {
  readonly world: ToonVisibilityWorld;
  readonly player: Readonly<{ x: number; y: number }>;
  readonly bounds: ToonWorldBounds;
  readonly orientation: ViewOrientation;
}

export interface ToonVisibilityField {
  readonly visibleTiles: ReadonlySet<string>;
  readonly maskRects: readonly ToonMaskRect[];
  /** Null retains exact rectangle coverage for a field with mask holes. */
  readonly maskPaths?: readonly ToonMaskPath[] | null;
  readonly evaluatedCells: number;
  readonly lineOfSightChecks: number;
  readonly occluderChecks: number;
}

export function buildToonVisibilityField(
  input: ToonVisibilityBuildInput,
): ToonVisibilityField {
  const visibleTiles = new Set<string>();
  const maskTiles: ToonMaskTile[] = [];
  const bounds = boundedVisibilityBounds(input.bounds, input.player);
  const origin = {
    x: Math.floor(input.player.x),
    y: Math.floor(input.player.y),
  };
  let lineOfSightChecks = 0;
  const sweep = sweepAngularVisibility({
    bounds,
    origin,
    isOpaque: ({ x, y }) => !input.world.isWalkable(x, y),
    visit: ({ x, y }) => {
      lineOfSightChecks += 1;
      if (!hasToonLineOfSight(input, x, y)) return;
      appendVisibleTile({ input, visibleTiles, maskTiles, x, y });
    },
  });
  return {
    visibleTiles,
    maskRects: mergeToonMaskTiles(maskTiles),
    maskPaths: conservativeToonMaskPaths(maskTiles),
    evaluatedCells: sweep.evaluatedCells,
    lineOfSightChecks,
    occluderChecks: sweep.occluderChecks,
  };
}

export function toonTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isToonPositionVisible(
  field: ToonVisibilityField,
  x: number,
  y: number,
): boolean {
  return field.visibleTiles.has(toonTileKey(Math.floor(x), Math.floor(y)));
}

function boundedVisibilityBounds(
  bounds: ToonWorldBounds,
  player: Readonly<{ x: number; y: number }>,
): ToonWorldBounds {
  const margin = TOON_LIGHTING_TUNING.cameraMarginTiles;
  const expanded = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };
  const maximum = TOON_LIGHTING_TUNING.maximumFieldCells;
  if (expanded.width * expanded.height <= maximum) return expanded;
  return centeredBounds(expanded, player, maximum);
}

function centeredBounds(
  bounds: ToonWorldBounds,
  player: Readonly<{ x: number; y: number }>,
  maximumCells: number,
): ToonWorldBounds {
  const aspect = bounds.width / Math.max(1, bounds.height);
  const height = Math.max(1, Math.floor(Math.sqrt(maximumCells / aspect)));
  const width = Math.max(1, Math.floor(maximumCells / height));
  return {
    x: Math.floor(player.x - width / 2),
    y: Math.floor(player.y - height / 2),
    width,
    height,
  };
}

function appendVisibleTile(input: {
  readonly input: ToonVisibilityBuildInput;
  readonly visibleTiles: Set<string>;
  readonly maskTiles: ToonMaskTile[];
  readonly x: number;
  readonly y: number;
}): void {
  const { world, orientation } = input.input;
  input.visibleTiles.add(toonTileKey(input.x, input.y));
  input.maskTiles.push(toonMaskTileFor({
    world,
    x: input.x,
    y: input.y,
    orientation,
  }));
}

function hasToonLineOfSight(
  input: ToonVisibilityBuildInput,
  x: number,
  y: number,
): boolean {
  return hasTerrainLineOfSight({
    world: input.world,
    from: input.player,
    to: { x: x + 0.5, y: y + 0.5 },
    maximumHeightDifference: TOON_LIGHTING_TUNING.maximumHeightDifference,
  });
}
