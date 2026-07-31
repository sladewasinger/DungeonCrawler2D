import {
  MELEE_ARC_COS,
  MELEE_RANGE,
} from "@dc2d/engine";

export interface GuardWedgeGeometry {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly radiusPx: number;
}

/**
 * Restores the broad shield silhouette players read before guard collision was
 * introduced. The authoritative collider is intentionally shorter and remains
 * defined independently in engine/combat/geometry/guardCollision.ts.
 */
export function guardWedgeGeometry(
  facingAngle: number,
  tilePx: number,
): GuardWedgeGeometry {
  const halfAngle = Math.acos(MELEE_ARC_COS);
  return {
    startAngle: facingAngle - halfAngle,
    endAngle: facingAngle + halfAngle,
    radiusPx: MELEE_RANGE * tilePx,
  };
}
