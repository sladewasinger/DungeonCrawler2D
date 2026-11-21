import type { AdminMap } from "@dc2d/engine";
import type { AdminPlayerObserverRenderInput } from "./adminPlayerObserver.js";

export interface AdminLiveViewerProjection {
  readonly active: boolean;
  readonly targetId: string | null;
  readonly map: AdminMap | null;
  readonly zoom: number;
}

export function adminLiveViewerProjection(
  input: AdminPlayerObserverRenderInput,
  zoom: number,
): AdminLiveViewerProjection {
  const active = input.spectatorMode !== "off";
  return {
    active,
    targetId: trackedTargetId(input),
    map: input.spectatorMap,
    zoom,
  };
}

function trackedTargetId(input: AdminPlayerObserverRenderInput): string | null {
  if (input.spectatorMode !== "track") return null;
  return input.spectatorTargetId ?? input.player?.playerId ?? null;
}
