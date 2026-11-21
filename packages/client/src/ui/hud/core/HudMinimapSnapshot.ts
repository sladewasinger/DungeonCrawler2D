import type { World } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import { buildMinimapSnapshot } from "../../../scenes/dungeon/hud/minimapSnapshot.js";
import { cachedMinimapTerrain } from "../../../scenes/dungeon/hud/minimap/minimapTerrainCache.js";
import type { MinimapSnapshot } from "../model/minimap/minimapTypes.js";
import type { HudFakeSnapshot } from "../../widgets/hud/core/fakeData.js";

export interface HudMinimapRequest {
  readonly connection: Connection;
  readonly world: World;
  readonly player: Pick<FirstPersonState, "x" | "z">;
  readonly snapshot?: Pick<HudFakeSnapshot, "minimap"> | undefined;
}

export function resolveHudMinimap(request: HudMinimapRequest): MinimapSnapshot {
  const existing = request.snapshot?.minimap;
  if (existing && (existing.terrain.length > 0 || !request.world.floorBounds)) return existing;
  if (existing) return { ...existing, terrain: cachedMinimapTerrain(request.world, request.player.x, request.player.z) };
  return buildMinimapSnapshot({
    connection: request.connection,
    world: request.world,
    centerX: request.player.x,
    centerY: request.player.z,
  });
}
