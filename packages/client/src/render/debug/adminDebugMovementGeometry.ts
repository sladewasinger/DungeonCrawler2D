import type { AdminMapEntity } from "@dc2d/engine";
import type { AdminDebugPoint } from "./adminDebugGeometry.js";

export interface AdminDebugMovementCollision {
  readonly center: AdminDebugPoint;
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly grounded: boolean;
  readonly groundHeight: number;
}

export function movementCollision(
  entity: AdminMapEntity,
): AdminDebugMovementCollision | undefined {
  const collision = entity.debug?.movementCollision;
  if (!collision) return undefined;
  return {
    center: { x: entity.x, y: entity.y, z: entity.z },
    ...collision,
  };
}

export function movementCollisionOutline(
  collision: AdminDebugMovementCollision,
): AdminDebugPoint[] {
  const { center, halfWidth, halfDepth } = collision;
  return [
    { x: center.x - halfWidth, y: center.y - halfDepth, z: center.z },
    { x: center.x + halfWidth, y: center.y - halfDepth, z: center.z },
    { x: center.x + halfWidth, y: center.y + halfDepth, z: center.z },
    { x: center.x - halfWidth, y: center.y + halfDepth, z: center.z },
    { x: center.x - halfWidth, y: center.y - halfDepth, z: center.z },
  ];
}

export function movementGroundProbe(
  collision: AdminDebugMovementCollision,
): readonly [AdminDebugPoint, AdminDebugPoint] {
  const { x, y, z } = collision.center;
  return [{ x, y, z: collision.groundHeight }, { x, y, z }];
}
