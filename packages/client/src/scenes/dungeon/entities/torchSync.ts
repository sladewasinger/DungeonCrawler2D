// Wires live torch entities into the terrain renderer's targeted light rebake and the
// lighting system's accent-light halos — the seam between net snapshots
// (InterpolatedEntity) and the pure render/lighting/placedTorches.ts helpers.
import { TICK_RATE } from "@dc2d/engine";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import {
  appendFlyingTorchLights,
  appendPlacedTorchLights,
  placedTorchSeeds,
  torchEmberFade,
  type PlacedTorch,
  updatePlacedTorchTiles,
} from "../../../render/lighting/torches/placedTorches.js";
import type { TilePos } from "../../../render/lighting/torches/torchPlacement.js";
import type { TorchEntityView } from "../../../render/entities/geometry/index.js";
import type { TerrainRendererLike } from "../../../render/terrain4/index.js";
import { torchView, type InterpolatedEntity } from "./entityViews.js";
import { mapFrameInto } from "./frameEntityViews.js";

export interface TorchSyncState {
  readonly placedTiles: Map<string, TilePos>;
  readonly seenPlacedIds: Set<string>;
  readonly changedTiles: TilePos[];
  readonly views: TorchEntityView[];
  readonly viewRecords: TorchEntityView[];
  readonly placed: PlacedTorch[];
  readonly flying: TorchEntityView[];
  readonly accentLights: LightSource[];
  readonly result: TorchSyncResult;
  terrain: TerrainRendererLike | null;
}

export function createTorchSyncState(): TorchSyncState {
  const views: TorchEntityView[] = [];
  const accentLights: LightSource[] = [];
  return {
    placedTiles: new Map(),
    seenPlacedIds: new Set(),
    changedTiles: [],
    views,
    viewRecords: [],
    placed: [],
    flying: [],
    accentLights,
    result: { views, accentLights },
    terrain: null,
  };
}

export interface TorchSyncResult {
  readonly views: TorchEntityView[];
  readonly accentLights: LightSource[];
}

interface TorchFrameRequest {
  readonly state: TorchSyncState;
  readonly torches: readonly InterpolatedEntity[];
  readonly serverTick: number;
}

function buildTorchFrame({ state, torches, serverTick }: TorchFrameRequest): void {
  const views = mapFrameInto({ source: torches, out: state.views, records: state.viewRecords, map: torchView });
  state.placed.length = 0;
  state.flying.length = 0;
  for (let index = 0; index < views.length; index++) {
    const view = views[index];
    if (!view) continue;
    appendTorchView({ view, entity: torches[index], serverTick, placed: state.placed, flying: state.flying });
  }
}

interface TorchViewAppendRequest {
  readonly view: TorchEntityView;
  readonly entity: InterpolatedEntity | undefined;
  readonly serverTick: number;
  readonly placed: PlacedTorch[];
  readonly flying: TorchEntityView[];
}

function appendTorchView({ view, entity, serverTick, placed, flying }: TorchViewAppendRequest): void {
  if (view.state === "flying") return void flying.push(view);
  if (view.state !== "placed") return;
  const ticksRemaining = (entity?.snap.expiresAtTick ?? Number.POSITIVE_INFINITY) - serverTick;
  placed.push({ id: view.id, tileX: Math.floor(view.x), tileY: Math.floor(view.y), emberFade: torchEmberFade(ticksRemaining, TICK_RATE) });
}

/**
 * One frame's torch handling: builds entity-renderer views, feeds the terrain
 * renderer this frame's dynamic light sources, forces a targeted rebake of any tile
 * that just started or stopped glowing (landed, expired, or was picked up — all the
 * same "entity removed/changed" shape, no bespoke event needed), and returns the
 * halo/flame accent lights for LightingSystem.setAccentLights.
 */
export interface TorchSyncRequest {
  readonly state: TorchSyncState;
  readonly torches: readonly InterpolatedEntity[];
  readonly terrain: TerrainRendererLike;
  /** The last snapshot's tick — the reference point `expiresAtTick` counts down to,
   * for the fading-ember halo tell in a placed torch's last EMBER_FADE_SECONDS. */
  readonly serverTick: number;
}

export function syncTorches({ state, torches, terrain, serverTick }: TorchSyncRequest): TorchSyncResult {
  buildTorchFrame({ state, torches, serverTick });
  const changedTiles = updatePlacedTorchTiles(state, state.placed);
  const terrainChanged = state.terrain !== terrain;
  state.terrain = terrain;
  if (terrainChanged || changedTiles.length > 0) {
    terrain.setDynamicLights(placedTorchSeeds(state.placed));
  }
  if (changedTiles.length > 0) terrain.rebuildAffected(changedTiles);

  const accentLights = state.accentLights;
  accentLights.length = 0;
  appendPlacedTorchLights(state.placed, accentLights);
  appendFlyingTorchLights(state.flying, accentLights);
  return state.result;
}
