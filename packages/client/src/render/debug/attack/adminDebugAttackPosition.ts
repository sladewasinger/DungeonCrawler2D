import type { AdminHitbox, AdminMapEntity } from "@dc2d/engine";
import type { AdminDebugPoint } from "../adminDebugGeometry.js";

type PositionedAttack = Exclude<AdminHitbox, { readonly shape: "tile" }>;

export function attackCenter(
  entity: AdminMapEntity,
  hitbox: PositionedAttack,
): AdminDebugPoint {
  return {
    x: entity.x,
    y: entity.y,
    z: entity.z + (hitbox.strikeHeightOffset ?? 0),
  };
}

export function attackVolumeRange(
  entity: AdminMapEntity,
  hitbox: AdminHitbox,
): { readonly minimumZ: number; readonly strikeZ: number; readonly maximumZ: number } | undefined {
  if (hitbox.shape === "tile") return undefined;
  if (hitbox.strikeHeightOffset === undefined || hitbox.verticalHalfExtent === undefined) return undefined;
  const strikeZ = entity.z + hitbox.strikeHeightOffset;
  return {
    minimumZ: strikeZ - hitbox.verticalHalfExtent,
    strikeZ,
    maximumZ: strikeZ + hitbox.verticalHalfExtent,
  };
}

/** Unique authoritative strike planes currently present in diagnostics. */
export function attackStrikeHeights(
  entities: readonly AdminMapEntity[],
): readonly number[] {
  const heights = new Set<number>();
  for (const entity of entities) {
    for (const hitbox of entity.debug?.attacks ?? []) {
      const range = attackVolumeRange(entity, hitbox);
      if (range) heights.add(range.strikeZ);
    }
  }
  return [...heights];
}
