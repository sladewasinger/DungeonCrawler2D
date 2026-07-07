import type { BodyState } from "./movement";

/**
 * The universal entity model. Players, enemies, ground items, and
 * projectiles are all entities: a body in the world + stats + tags +
 * active statuses. Tags are the vocabulary every system keys off —
 * interaction rules and AI never reference specific ids, only tags.
 */

export type EntityKind = "player" | "enemy" | "item" | "projectile";

export interface ActiveStatus {
  defId: string;
  /** Seconds left; null = until removed. */
  remaining: number | null;
  /** Accumulator toward the next onTick firing. */
  tickAccum: number;
  stacks: number;
}

export interface Entity {
  id: string;
  kind: EntityKind;
  body: BodyState;
  /** Content definition id (enemies: enemy def; items/projectiles: item def). */
  defId?: string;
  name?: string;
  hp: number;
  maxHp: number;
  /** Base move speed in tiles/s (statuses multiply it). */
  baseSpeed: number;
  /** Permanent tags from the definition (flammable, undead, …). */
  tags: ReadonlySet<string>;
  statuses: ActiveStatus[];
  /** Item stack size (kind === "item"). */
  qty: number;
  /** Projectile state (kind === "projectile"). */
  vel?: { x: number; y: number; z: number };
  ownerId?: string;
  /** Party members never stop being valid melee targets — but the
   * targeting aid deprioritizes them. Kept on the entity for AOI-free
   * lookups. */
  partyId?: string;
  /** Downed players bleed out unless revived (party feature). */
  downedUntil?: number;
}

let nextEntityId = 1;

/** Reset only from tests. */
export function resetEntityIds(): void {
  nextEntityId = 1;
}

export function newEntityId(prefix: string): string {
  return `${prefix}${nextEntityId++}`;
}

export function makeEntity(
  kind: EntityKind,
  body: BodyState,
  opts: Partial<Omit<Entity, "kind" | "body">> = {},
): Entity {
  return {
    id: opts.id ?? newEntityId(kind[0]!),
    kind,
    body,
    hp: opts.hp ?? 1,
    maxHp: opts.maxHp ?? opts.hp ?? 1,
    baseSpeed: opts.baseSpeed ?? 0,
    tags: opts.tags ?? new Set(),
    statuses: [],
    qty: opts.qty ?? 1,
    ...(opts.defId !== undefined ? { defId: opts.defId } : {}),
    ...(opts.name !== undefined ? { name: opts.name } : {}),
    ...(opts.vel !== undefined ? { vel: opts.vel } : {}),
    ...(opts.ownerId !== undefined ? { ownerId: opts.ownerId } : {}),
  };
}

/**
 * All tags currently on an entity: base tags + tags applied by active
 * statuses + the derived `airborne` tag.
 */
export function entityTags(
  entity: Entity,
  statusAppliesTags: (defId: string) => readonly string[] | undefined,
): Set<string> {
  const tags = new Set(entity.tags);
  for (const status of entity.statuses) {
    const applied = statusAppliesTags(status.defId);
    if (applied) for (const t of applied) tags.add(t);
  }
  if (!entity.body.grounded) tags.add("airborne");
  return tags;
}
