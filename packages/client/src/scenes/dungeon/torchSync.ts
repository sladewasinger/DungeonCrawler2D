// Wires live torch entities into the terrain renderer's targeted light rebake and the
// lighting system's accent-light halos — the seam between net snapshots
// (InterpolatedEntity) and the pure render/lighting/placedTorches.ts helpers.
import { TICK_RATE } from "@dc2d/engine";
import type { LightSource } from "../../render/lighting/lightSource.js";
import {
  diffPlacedTorches,
  flyingTorchLights,
  placedTorchLights,
  placedTorchSeeds,
  torchEmberFade,
  type PlacedTorch,
} from "../../render/lighting/placedTorches.js";
import type { TilePos } from "../../render/lighting/torchPlacement.js";
import type { TorchEntityView } from "../../render/entities/index.js";
import type { TerrainRenderer } from "../../render/terrain/index.js";
import { torchView, type InterpolatedEntity } from "./entityViews.js";

export interface TorchSyncState {
  placedTiles: Map<string, TilePos>;
}

export function createTorchSyncState(): TorchSyncState {
  return { placedTiles: new Map() };
}

export interface TorchSyncResult {
  readonly views: TorchEntityView[];
  readonly accentLights: LightSource[];
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
  const views = torches.map(torchView);
  const placed: PlacedTorch[] = [];
  views.forEach((v, i) => {
    if (v.state !== "placed") return;
    const expiresAtTick = torches[i]?.snap.expiresAtTick;
    const ticksRemaining = expiresAtTick === undefined ? Number.POSITIVE_INFINITY : expiresAtTick - serverTick;
    placed.push({
      id: v.id,
      tileX: Math.floor(v.x),
      tileY: Math.floor(v.y),
      emberFade: torchEmberFade(ticksRemaining, TICK_RATE),
    });
  });

  terrain.setDynamicLights(placedTorchSeeds(placed));
  const { changedTiles, next } = diffPlacedTorches(state.placedTiles, placed);
  state.placedTiles = next;
  if (changedTiles.length > 0) terrain.rebuildAffected(changedTiles);

  const flying = views.filter((v) => v.state === "flying");
  return { views, accentLights: [...placedTorchLights(placed), ...flyingTorchLights(flying)] };
}
