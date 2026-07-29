import type { ContentRegistry } from "../../types.js";
import type { AreaCellStorage } from "../storage.js";
import type { AreaLayer, AreaPlacementResult } from "../types.js";
import { resolveAreaTransitions } from "./transitions.js";

export interface AreaTransitionCommit {
  readonly content: ContentRegistry;
  readonly storage: AreaCellStorage;
  readonly x: number;
  readonly y: number;
  readonly layers: AreaLayer[];
  readonly publish: boolean;
}

export function commitAreaTransition(
  request: AreaTransitionCommit,
): AreaPlacementResult {
  const transition = resolveAreaTransitions(request.content, request.layers);
  if (!transition.ok) {
    request.storage.diagnose(`${request.x},${request.y}: ${transition.detail}`);
    return {
      applied: false,
      reason: "reaction-conflict",
      detail: transition.detail,
    };
  }
  request.storage.commit({
    x: request.x,
    y: request.y,
    layers: transition.layers,
    publish: request.publish,
  });
  return { applied: true };
}
