import type { BodyState } from "./movement/index.js";
import type { PlayerSkin } from "./playerAppearance.js";
import type { BallisticFlight, DirectProjectileImpact } from "./projectile.js";

/**
 * The universal entity model. Players, enemies, ground items, and
 * projectiles are all entities: a body in the world + stats + tags +
 * active statuses. Tags are the vocabulary every system keys off —
 * interaction rules and AI never reference specific ids, only tags.
 */

export type EntityKind = "player" | "enemy" | "pet" | "item" | "projectile" | "torch";

export interface ActiveStatus {
  defId: string;
  /** Authoritative entity that caused this status, retained through damage ticks. */
  sourceId?: string;
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
  /** Player-selected atlas animation prefix. */
  skin?: PlayerSkin;
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
  /** Resolved launch/landing contract retained while a ballistic entity is flying. */
  ballisticFlight?: BallisticFlight;
  /** Direct-hit payload captured when a hostile projectile launches. */
  directProjectileImpact?: DirectProjectileImpact;
  /** Player who returned a hostile direct projectile; it can then hit enemies only. */
  returnedByPlayerId?: string;
  /** Last non-zero horizontal intent, normalized for presentation. */
  facing?: { x: number; y: number };
  ownerId?: string;
  /** Party members never stop being valid melee targets — but the
   * targeting aid deprioritizes them. Kept on the entity for AOI-free
   * lookups. */
  partyId?: string;
  /** Downed players bleed out unless revived by a nearby crawler. */
  downedUntil?: number;
  /** Flight/placement state (kind === "torch"): mid-arc, or planted and burning. */
  torchState?: "flying" | "placed";
  /** Tick a placed torch despawns (kind === "torch", torchState === "placed"). */
  expiresAtTick?: number;
}

let nextEntityId = 1;

/** Reset only from tests. */
export function resetEntityIds(): void {
  nextEntityId = 1;
}

export function newEntityId(prefix: string): string {
  return `${prefix}${nextEntityId++}`;
}

/** Optional presentation, motion, projectile-combat, and ownership fields. */
function applyOptionalEntityFields(
  entity: Entity,
  opts: Partial<Omit<Entity, "kind" | "body">>,
): void {
  applyPresentationFields(entity, opts);
  applyMotionFields(entity, opts);
  applyProjectileCombatFields(entity, opts);
  applyOwnershipFields(entity, opts);
}

function applyPresentationFields(entity: Entity, opts: Partial<Entity>): void {
  if (opts.defId !== undefined) entity.defId = opts.defId;
  if (opts.name !== undefined) entity.name = opts.name;
  if (opts.skin !== undefined) entity.skin = opts.skin;
}

function applyMotionFields(entity: Entity, opts: Partial<Entity>): void {
  if (opts.vel !== undefined) entity.vel = opts.vel;
  if (opts.ballisticFlight !== undefined) entity.ballisticFlight = opts.ballisticFlight;
  if (opts.facing !== undefined) entity.facing = opts.facing;
}

function applyProjectileCombatFields(entity: Entity, opts: Partial<Entity>): void {
  if (opts.directProjectileImpact !== undefined) {
    entity.directProjectileImpact = opts.directProjectileImpact;
  }
  if (opts.returnedByPlayerId !== undefined) {
    entity.returnedByPlayerId = opts.returnedByPlayerId;
  }
}

function applyOwnershipFields(entity: Entity, opts: Partial<Entity>): void {
  if (opts.ownerId !== undefined) entity.ownerId = opts.ownerId;
  if (opts.torchState !== undefined) entity.torchState = opts.torchState;
  if (opts.expiresAtTick !== undefined) entity.expiresAtTick = opts.expiresAtTick;
}

export function makeEntity(
  kind: EntityKind,
  body: BodyState,
  opts: Partial<Omit<Entity, "kind" | "body">> = {},
): Entity {
  const entity: Entity = {
    ...entityDefaults(kind, opts),
    kind,
    body,
    statuses: [],
  };
  applyOptionalEntityFields(entity, opts);
  return entity;
}

function entityDefaults(kind: EntityKind, opts: Partial<Entity>): Pick<Entity, "id" | "hp" | "maxHp" | "baseSpeed" | "tags" | "qty"> {
  return {
    id: opts.id ?? newEntityId(kind[0] ?? "e"),
    hp: opts.hp ?? 1,
    maxHp: maxHp(opts),
    baseSpeed: opts.baseSpeed ?? 0,
    tags: opts.tags ?? new Set(),
    qty: opts.qty ?? 1,
  };
}

function maxHp(opts: Partial<Entity>): number {
  return opts.maxHp ?? opts.hp ?? 1;
}

export function faceEntity(entity: Entity, x: number, y: number): void {
  const length = Math.hypot(x, y);
  if (length === 0) return;
  entity.facing = { x: x / length, y: y / length };
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
    addStatusTags(tags, status, statusAppliesTags);
  }
  if (!entity.body.grounded) tags.add("airborne");
  return tags;
}

function addStatusTags(
  tags: Set<string>,
  status: ActiveStatus,
  statusAppliesTags: (defId: string) => readonly string[] | undefined,
): void {
  const applied = statusAppliesTags(status.defId);
  if (!applied) return;
  for (const tag of applied) tags.add(tag);
}
