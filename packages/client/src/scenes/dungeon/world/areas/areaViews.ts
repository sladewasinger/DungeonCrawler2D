import { areasData } from "@dc2d/content";
import type {
  AreaSpriteKind,
  AreaTileView,
} from "../../../../vfx/system/index.js";
import { connectedAreaNeighborMask } from "../../../../vfx/areas/puddles/areaTileTopology.js";
import { areaCellSurface, type AreaGroundSampler } from "./areaCellSurface.js";
import { areaCellVisible, parseAreaCellPosition } from "./areaViewGeometry.js";
import { writeAreaView } from "./areaViewRecord.js";
import type {
  TerrainPresentationVisibility,
} from "../../../../render/entities/presentation/visibility/entityPresentationVisibility.js";

interface AreaDef {
  readonly id: string;
  readonly sprite: AreaSpriteKind;
}

const spriteByAreaId = new Map<string, AreaSpriteKind>(
  (areasData as readonly unknown[])
    .filter(isAreaDef)
    .map((def) => [def.id, def.sprite]),
);

export interface AreaViewBounds {
  readonly x: number;
  readonly y: number;
  readonly right: number;
  readonly bottom: number;
}

export interface AreaTileViewFrame {
  readonly areaTiles: ReadonlyMap<string, string>;
  readonly areaLayers?: ReadonlyMap<string, readonly string[]>;
  /** Live terrain sampler; area surfaces never assume flat z=0. */
  readonly groundAt: AreaGroundSampler;
  readonly bounds: AreaViewBounds | undefined;
  readonly marginPx: number;
  readonly views: AreaTileView[];
  readonly records: AreaTileView[];
  readonly terrainVisibility?: TerrainPresentationVisibility | undefined;
}

interface AreaViewBuildState extends AreaTileViewFrame {
  count: number;
}

export interface AreaTileViewBuildRequest {
  readonly areaTiles: ReadonlyMap<string, string>;
  readonly areaLayers?: ReadonlyMap<string, readonly string[]>;
  readonly groundAt: AreaGroundSampler;
  readonly bounds?: AreaViewBounds;
  readonly marginPx?: number;
  readonly terrainVisibility?: TerrainPresentationVisibility | undefined;
}

export function buildAreaTileViews(
  request: AreaTileViewBuildRequest,
): AreaTileView[] {
  return buildAreaTileViewsInto({
    ...request,
    bounds: request.bounds,
    marginPx: request.marginPx ?? 0,
    views: [],
    records: [],
  });
}

export function buildAreaTileViewsInto(
  frame: AreaTileViewFrame,
): AreaTileView[] {
  const state: AreaViewBuildState = { ...frame, count: 0 };
  for (const [key, fallbackDefId] of frame.areaTiles) {
    appendAreaCell(state, key, fallbackDefId);
  }
  frame.views.length = state.count;
  return frame.views;
}

function appendAreaCell(
  state: AreaViewBuildState,
  key: string,
  fallbackDefId: string,
): void {
  const cell = parseAreaCellPosition(key);
  const surface = areaCellSurface(cell, state.groundAt);
  if (state.terrainVisibility && !state.terrainVisibility.isWorldPositionVisible(
    cell.x + 0.5,
    cell.y + 0.5,
  )) {
    return;
  }
  if (!areaCellVisible({
    screen: surface.screen,
    bounds: state.bounds,
    marginPx: state.marginPx,
  })) {
    return;
  }
  const layers = state.areaLayers?.get(key);
  if (layers) {
    for (const defId of layers) {
      appendAreaLayer({ state, defId, surface });
    }
    return;
  }
  appendAreaLayer({ state, defId: fallbackDefId, surface });
}

function appendAreaLayer(
  input: {
    readonly state: AreaViewBuildState;
    readonly defId: string;
    readonly surface: ReturnType<typeof areaCellSurface>;
  },
): void {
  const { state, defId, surface } = input;
  const sprite = spriteByAreaId.get(defId);
  if (!sprite) return;
  const { cell, groundHeight, screen } = surface;
  const neighborMask = connectedAreaNeighborMask({
    areaTiles: state.areaTiles,
    areaLayers: state.areaLayers,
    spriteByAreaId,
    x: cell.x,
    y: cell.y,
    groundHeight,
    sprite,
    groundAt: state.groundAt,
  });
  const view = writeAreaView(state.records[state.count], {
    key: cell.key,
    defId,
    cell,
    groundHeight,
    screen,
    sprite,
    neighborMask,
  });
  state.records[state.count] = view;
  state.views[state.count] = view;
  state.count++;
}

function isAreaDef(value: unknown): value is AreaDef {
  const record = value as Partial<AreaDef>;
  return typeof record?.id === "string" &&
    typeof record?.sprite === "string";
}
