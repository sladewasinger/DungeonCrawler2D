// Wires live torch entities into terrain entity views and lighting accent halos. The
// low-resolution atmosphere pass now owns reveal, so torch land/expiry no longer causes
// a terrain chunk rebake.
import { TICK_RATE } from "@dc2d/engine";
import type { TorchEntityView } from "../../../../render/entities/geometry/index.js";
import { torchGroundAnchor } from "../../../../render/entities/presentation/torch/groundAnchor.js";
import type { LightSource } from "../../../../render/lighting/core/lightSource.js";
import {
  appendFlyingTorchLights,
  appendPlacedTorchLights,
  torchEmberFade,
  type PlacedTorch,
} from "../../../../render/lighting/torches/placedTorches.js";
import type { TerrainRendererLike } from "../../../../render/terrain/index.js";
import { torchView, type InterpolatedEntity } from "../entityViews.js";
import { mapFrameInto } from "../frameEntityViews.js";

export interface TorchSyncState {
  readonly views: TorchEntityView[];
  readonly viewRecords: TorchEntityView[];
  readonly placed: PlacedTorch[];
  readonly flying: TorchEntityView[];
  readonly accentLights: LightSource[];
  readonly result: TorchSyncResult;
}

export function createTorchSyncState(): TorchSyncState {
  const views: TorchEntityView[] = [];
  const accentLights: LightSource[] = [];
  return {
    views,
    viewRecords: [],
    placed: [],
    flying: [],
    accentLights,
    result: { views, accentLights },
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
  placed.push({
    id: view.id,
    ...torchGroundAnchor(view),
    emberFade: torchEmberFade(ticksRemaining, TICK_RATE),
  });
}

/**
 * One frame's torch handling: builds entity-renderer views and returns halo/flame
 * accent lights for LightingSystem.setAccentLights. `terrain` remains in the request
 * as a compatibility seam for the frame orchestrator while it owns terrain lifetime.
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
  void terrain;
  buildTorchFrame({ state, torches, serverTick });
  const accentLights = state.accentLights;
  accentLights.length = 0;
  appendPlacedTorchLights(state.placed, accentLights);
  appendFlyingTorchLights(state.flying, accentLights);
  return state.result;
}
