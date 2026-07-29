import { statusesData } from "@dc2d/content";
import {
  statusDefSchema,
  type ContinuousMovementSpeedProjection,
  type ContinuousMovementStatusSnapshot,
  type StatusDef,
} from "@dc2d/engine";

const definitions = buildDefinitions();

export function movementSpeedProjection(
  currentSpeed: number,
  statuses: readonly ContinuousMovementStatusSnapshot[],
): ContinuousMovementSpeedProjection {
  return {
    currentSpeed,
    statuses,
    statusDefinition: movementStatusDefinition,
  };
}

function movementStatusDefinition(statusId: string): StatusDef | undefined {
  return definitions.get(statusId);
}

function buildDefinitions(): ReadonlyMap<string, StatusDef> {
  const result = new Map<string, StatusDef>();
  for (const raw of statusesData) {
    const parsed = statusDefSchema.safeParse(raw);
    if (parsed.success) result.set(parsed.data.id, parsed.data);
  }
  return result;
}
