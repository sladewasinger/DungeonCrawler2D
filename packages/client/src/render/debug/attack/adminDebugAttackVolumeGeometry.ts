import type { AdminHitbox, AdminMapEntity } from "@dc2d/engine";
import {
  circleOutline,
  hitboxCircle,
  hitboxWedge,
  wedgeOutline,
  type AdminDebugPoint,
} from "../adminDebugGeometry.js";
import { attackVolumeRange } from "./adminDebugAttackPosition.js";

export interface AdminDebugAttackVolume {
  readonly strike: readonly AdminDebugPoint[];
  readonly shell: readonly (readonly AdminDebugPoint[])[];
}

/** Exact vertical extrusion of an authoritative circle/cone attack diagnostic. */
export function attackVolumeGeometry(
  entity: AdminMapEntity,
  hitbox: AdminHitbox,
): AdminDebugAttackVolume | undefined {
  const range = attackVolumeRange(entity, hitbox);
  if (!range || hitbox.shape === "tile") return undefined;
  const strike = attackOutline(entity, hitbox);
  const bottom = outlineAtHeight(strike, range.minimumZ);
  const top = outlineAtHeight(strike, range.maximumZ);
  return {
    strike,
    shell: [bottom, top, ...verticalEdges(bottom, top, hitbox.shape)],
  };
}

function attackOutline(
  entity: AdminMapEntity,
  hitbox: Exclude<AdminHitbox, { readonly shape: "tile" }>,
): AdminDebugPoint[] {
  if (hitbox.shape === "circle") return circleOutline(hitboxCircle(entity, hitbox));
  return wedgeOutline(hitboxWedge(entity, hitbox));
}

function outlineAtHeight(
  outline: readonly AdminDebugPoint[],
  z: number,
): AdminDebugPoint[] {
  return outline.map((point) => ({ ...point, z }));
}

function verticalEdges(
  bottom: readonly AdminDebugPoint[],
  top: readonly AdminDebugPoint[],
  shape: "circle" | "cone",
): AdminDebugPoint[][] {
  const indices = shape === "circle"
    ? quarterIndices(bottom.length - 1)
    : [0, 1, Math.floor((bottom.length - 1) / 2), bottom.length - 2];
  return [...new Set(indices)].map((index) => [bottom[index]!, top[index]!]);
}

function quarterIndices(segmentCount: number): number[] {
  return [0, 0.25, 0.5, 0.75].map((fraction) => Math.round(segmentCount * fraction));
}
