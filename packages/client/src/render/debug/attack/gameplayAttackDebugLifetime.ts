import type { AdminHitbox, AdminMapEntity } from "@dc2d/engine";
import { WEDGE_FADE_MS } from "../../../vfx/combat/melee/meleeWedgeGeometry.js";

/** Keeps server-present weapon diagnostics within the same window as the swing cone. */
export class GameplayAttackDebugLifetime {
  private readonly startedAt = new Map<string, number>();

  visibleEntities(
    entities: readonly AdminMapEntity[],
    nowMs: number,
  ): readonly AdminMapEntity[] {
    const activeIds = new Set<string>();
    const visible = entities.map((entity) => this.visibleEntity(entity, nowMs, activeIds));
    this.prune(activeIds);
    return visible;
  }

  clear(): void {
    this.startedAt.clear();
  }

  private visibleEntity(
    entity: AdminMapEntity,
    nowMs: number,
    activeIds: Set<string>,
  ): AdminMapEntity {
    const attacks = entity.debug?.attacks;
    if (!attacks?.some(isTimedActiveWeaponVolume)) return entity;
    activeIds.add(entity.id);
    const startedAt = this.startedAt.get(entity.id) ?? nowMs;
    this.startedAt.set(entity.id, startedAt);
    const visibleAttacks = nowMs - startedAt < WEDGE_FADE_MS
      ? attacks
      : attacks.filter((attack) => !isTimedActiveWeaponVolume(attack));
    return withAttacks(entity, visibleAttacks);
  }

  private prune(activeIds: ReadonlySet<string>): void {
    for (const id of this.startedAt.keys()) {
      if (!activeIds.has(id)) this.startedAt.delete(id);
    }
  }
}

export function isWeaponVolume(hitbox: AdminHitbox): boolean {
  return hitbox.shape !== "tile" &&
    hitbox.strikeHeightOffset !== undefined &&
    hitbox.verticalHalfExtent !== undefined;
}

function isTimedActiveWeaponVolume(hitbox: AdminHitbox): boolean {
  return isWeaponVolume(hitbox) &&
    !("preview" in hitbox && hitbox.preview === true);
}

function withAttacks(
  entity: AdminMapEntity,
  attacks: readonly AdminHitbox[],
): AdminMapEntity {
  if (attacks === entity.debug?.attacks) return entity;
  const debug = entity.debug;
  if (!debug) return entity;
  return {
    ...entity,
    debug: attacks.length > 0
      ? { ...debug, attacks: [...attacks] }
      : withoutAttacks(debug),
  };
}

function withoutAttacks(
  debug: NonNullable<AdminMapEntity["debug"]>,
): NonNullable<AdminMapEntity["debug"]> {
  const entries = Object.entries(debug).filter(([key]) => key !== "attacks");
  return Object.fromEntries(entries) as NonNullable<AdminMapEntity["debug"]>;
}
