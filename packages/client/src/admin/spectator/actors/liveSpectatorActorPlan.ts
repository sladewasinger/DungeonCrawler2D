import type { AdminMap, AdminMapEntity } from "@dc2d/engine";
import { liveSpectatorPoint, type LiveSpectatorView } from "../liveSpectatorView.js";

export interface LiveSpectatorActorPlan {
  readonly entity: AdminMapEntity;
  readonly target: boolean;
}

export interface LiveSpectatorActorPlanInput {
  readonly map: AdminMap;
  readonly targetId: string | null;
  readonly view: LiveSpectatorView;
}

export function liveSpectatorActorPlan(
  input: LiveSpectatorActorPlanInput,
): readonly LiveSpectatorActorPlan[] {
  return [...input.map.entities]
    .sort((left, right) => entityDepth(left, input.view) - entityDepth(right, input.view))
    .map((entity) => ({ entity, target: entity.id === input.targetId }));
}

function entityDepth(entity: AdminMapEntity, view: LiveSpectatorView): number {
  return liveSpectatorPoint(view, entity, entity.z).y;
}
