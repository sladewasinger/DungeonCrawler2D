// Wires live torch entities into the terrain renderer's targeted light rebake and the
// lighting system's accent-light halos — the seam between net snapshots
// (InterpolatedEntity) and the pure render/lighting/placedTorches.ts helpers.
import { TICK_RATE } from "@dc2d/engine";
import type { LightSource } from "../../render/lighting/lightSource.js";
import {
  appendFlyingTorchLights,
  appendPlacedTorchLights,
  placedTorchSeeds,
  torchEmberFade,
  type PlacedTorch,
  updatePlacedTorchTiles,
} from "../../render/lighting/placedTorches.js";
import type { TilePos } from "../../render/lighting/torchPlacement.js";
import type { TorchEntityView } from "../../render/entities/index.js";
import type { TerrainRenderer } from "../../render/terrain/index.js";
import { torchView, type InterpolatedEntity } from "./entityViews.js";
import { mapFrameInto } from "./frameEntityViews.js";

export interface TorchSyncState {
  readonly placedTiles: Map<string, TilePos>;
  readonly seenPlacedIds: Set<string>;
  readonly changedTiles: TilePos[];
  readonly views: TorchEntityView[];
  readonly placed: PlacedTorch[];
  readonly flying: TorchEntityView[];
  readonly accentLights: LightSource[];
  readonly result: TorchSyncResult;
  terrain: TerrainRenderer | null;
}

export function createTorchSyncState(): TorchSyncState {
  const views: TorchEntityView[] = [];
  const accentLights: LightSource[] = [];
  return {
    placedTiles: new Map(),
    seenPlacedIds: new Set(),
    changedTiles: [],
    views,
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

function buildTorchFrame(
  state: TorchSyncState,
  torches: readonly InterpolatedEntity[],
  serverTick: number,
): void {
  const views = mapFrameInto(torches, state.views, torchView);
  state.placed.length = 0;
  state.flying.length = 0;
  for (let index = 0; index < views.length; index++) {
    const view = views[index];
    if (!view) continue;
    if (view.state === "flying") {
      state.flying.push(view);
      continue;
    }
    if (view.state !== "placed") continue;
    const expiresAtTick = torches[index]?.snap.expiresAtTick;
    const ticksRemaining = expiresAtTick === undefined
      ? Number.POSITIVE_INFINITY
      : expiresAtTick - serverTick;
    state.placed.push({
      id: view.id,
      tileX: Math.floor(view.x),
      tileY: Math.floor(view.y),
      emberFade: torchEmberFade(ticksRemaining, TICK_RATE),
    });
  }
}

/**
 * One frame's torch handling: builds entity-renderer views, feeds the terrain
 * renderer this frame's dynamic light sources, forces a targeted rebake of any tile
 * that just started or stopped glowing (landed, expired, or was picked up — all the
 * same "entity removed/changed" shape, no bespoke event needed), and returns the
 * halo/flame accent lights for LightingSystem.setAccentLights.
 */
export function syncTorches(
  state: TorchSyncState,
  torches: readonly InterpolatedEntity[],
  terrain: TerrainRenderer,
  /** The last snapshot's tick — the reference point `expiresAtTick` counts down to,
   * for the fading-ember halo tell in a placed torch's last EMBER_FADE_SECONDS. */
  serverTick: number,
): TorchSyncResult {
  buildTorchFrame(state, torches, serverTick);
  const changedTiles = updatePlacedTorchTiles(
    state.placedTiles,
    state.placed,
    state.seenPlacedIds,
    state.changedTiles,
  );
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
