import type { AdminMapEntity, DebugFlags, Entity } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";
import { adminMapDebugFields } from "../adminMapDebug.js";

const MAX_MAP_ENTITIES = 2048;

type AdminMapEntitySource = Pick<
  Entity,
  "id" | "kind" | "defId" | "name" | "body" | "facing" |
  "directProjectileImpact" | "combatHurtbox"
>;

const DIRECT_KINDS: Readonly<
  Partial<Record<AdminMapEntitySource["kind"], AdminMapEntity["kind"]>>
> = {
  player: "player", enemy: "enemy", pet: "pet",
  projectile: "projectile", torch: "torch",
};

export interface AdminMapEntityRequest {
  readonly center: { readonly x: number; readonly y: number };
  readonly radius: number;
  readonly includeProjectiles: boolean;
  readonly flags?: DebugFlags;
  readonly diagnosticsOnly?: boolean;
}

export function adminMapEntities(
  sim: SimState,
  request: AdminMapEntityRequest,
): AdminMapEntity[] {
  const entities = entitySources(sim, request.includeProjectiles);
  const projected = entities
    .filter((entity) => withinRadius(entity.body, request.center, request.radius + 1))
    .map((entity) => projectEntity(sim, entity, request.flags));
  return diagnosticsForRequest(projected, request.diagnosticsOnly)
    .slice(0, MAX_MAP_ENTITIES);
}

function diagnosticsForRequest(
  entities: AdminMapEntity[],
  diagnosticsOnly: boolean | undefined,
): AdminMapEntity[] {
  return diagnosticsOnly ? entities.filter((entity) => entity.debug !== undefined) : entities;
}

function entitySources(sim: SimState, includeProjectiles: boolean): AdminMapEntitySource[] {
  return [
    ...[...sim.players.values()].filter((slot) => slot.connected).map((slot) => slot.entity),
    ...[...sim.enemies.values()].map((slot) => slot.entity),
    ...[...sim.pets.values()].map((slot) => slot.entity),
    ...[...sim.items.values()],
    ...(includeProjectiles ? projectileDiagnostics(sim) : []),
    ...[...sim.torches.values()],
  ];
}

function projectileDiagnostics(sim: SimState): AdminMapEntitySource[] {
  return [...sim.projectiles.values()]
    .filter((projectile) => Boolean(projectile.directProjectileImpact));
}

function projectEntity(
  sim: SimState,
  entity: AdminMapEntitySource,
  flags: DebugFlags | undefined,
): AdminMapEntity {
  return {
    id: entity.id,
    kind: entityKind(sim, entity),
    ...(entity.defId ? { defId: entity.defId } : {}),
    ...(entity.name ? { name: entity.name } : {}),
    x: entity.body.x, y: entity.body.y, z: entity.body.z,
    ...adminMapDebugFields({ sim, entity, ...(flags ? { flags } : {}) }),
  };
}

function entityKind(sim: SimState, entity: AdminMapEntitySource): AdminMapEntity["kind"] {
  return DIRECT_KINDS[entity.kind] ?? itemEntityKind(sim, entity);
}

function itemEntityKind(sim: SimState, entity: AdminMapEntitySource): "item" | "weapon" {
  return entity.defId && sim.content.items.get(entity.defId)?.weapon ? "weapon" : "item";
}

function withinRadius(
  point: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number },
  radius: number,
): boolean {
  return Math.abs(point.x - center.x) <= radius &&
    Math.abs(point.y - center.y) <= radius;
}
