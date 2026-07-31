import type { AdminCommand } from "@dc2d/engine";
import { spawnEnemy } from "../enemies/enemySpawner.js";
import { spawnItem } from "../core/helpers.js";
import { PET_DEFINITIONS, spawnPetForPlayer } from "../pets/index.js";
import type { SimState } from "../state/state.js";
import type { AdminMutationResult } from "./adminControls.js";
import { enemyOccupancyIsAllowed } from "../enemies/roomIsolation/enemyRoomIsolation.js";

export function spawnAdminEntity(
  sim: SimState,
  command: Extract<AdminCommand, { op: "spawn" }>,
): AdminMutationResult {
  const location = centeredSpawnLocation(sim, command.x, command.y);
  if (!location) return { ok: false, code: "invalid_spawn_location" };
  if (command.kind === "enemy") return spawnEnemyEntity(sim, command.defId, location);
  if (command.kind === "pet") {
    return spawnPetEntity({ sim, defId: command.defId, location, ownerPlayerId: command.ownerPlayerId });
  }
  return spawnItemEntity({ sim, kind: command.kind, defId: command.defId, location });
}

export function despawnAdminEntity(
  sim: SimState,
  command: Extract<AdminCommand, { op: "despawn" }>,
): AdminMutationResult {
  if (sim.enemies.delete(command.entityId)) return { ok: true, message: `despawned enemy ${command.entityId}` };
  return despawnWeaponEntity(sim, command.entityId);
}

function spawnEnemyEntity(
  sim: SimState,
  defId: string,
  location: SpawnLocation,
): AdminMutationResult {
  if (!sim.content.enemies.has(defId)) return { ok: false, code: "enemy_not_found" };
  if (!enemyOccupancyIsAllowed(sim, location)) {
    return { ok: false, code: "invalid_spawn_location" };
  }
  const entity = spawnEnemy(sim, { defId, ...location });
  return { ok: true, message: `spawned enemy ${entity.id}` };
}

function spawnItemEntity(input: SpawnItemInput): AdminMutationResult {
  const def = input.sim.content.items.get(input.defId);
  if (!def) return { ok: false, code: "item_not_found" };
  if (input.kind === "weapon" && !def.weapon) return { ok: false, code: "weapon_not_found" };
  if (input.kind === "item" && def.weapon) return { ok: false, code: "item_is_weapon" };
  const entity = spawnItem(input.sim, { defId: input.defId, ...input.location });
  return { ok: true, message: `spawned ${input.kind} ${entity.id}` };
}

function spawnPetEntity(input: PetSpawnInput): AdminMutationResult {
  if (!input.ownerPlayerId) return { ok: false, code: "pet_owner_required" };
  const owner = input.sim.players.get(input.ownerPlayerId);
  if (!owner?.connected) return { ok: false, code: "pet_owner_not_found" };
  const definition = PET_DEFINITIONS.find((candidate) => candidate.id === input.defId);
  if (!definition) return { ok: false, code: "pet_not_found" };
  const entity = spawnPetForPlayer(input.sim, { definition, position: input.location, owner });
  return { ok: true, message: `spawned ${definition.name} for ${owner.entity.name ?? "player"} (${entity.id})` };
}

function centeredSpawnLocation(sim: SimState, x: number, y: number): SpawnLocation | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const location = { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
  return sim.world.isWalkable(location.x, location.y) ? location : null;
}

function despawnWeaponEntity(sim: SimState, entityId: string): AdminMutationResult {
  const entity = sim.items.get(entityId);
  if (!entity) return { ok: false, code: "entity_not_found" };
  const weapon = entity.defId && sim.content.items.get(entity.defId)?.weapon;
  if (!weapon) return { ok: false, code: "entity_not_removable" };
  sim.items.delete(entityId);
  return { ok: true, message: `despawned weapon ${entityId}` };
}

interface SpawnLocation { readonly x: number; readonly y: number }

interface PetSpawnInput {
  readonly sim: SimState;
  readonly defId: string;
  readonly location: SpawnLocation;
  readonly ownerPlayerId: string | undefined;
}

interface SpawnItemInput {
  readonly sim: SimState;
  readonly kind: "item" | "weapon";
  readonly defId: string;
  readonly location: SpawnLocation;
}
