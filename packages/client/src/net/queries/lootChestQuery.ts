import { INTERACT_RANGE, TICK_RATE, type EntitySnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import type { InterpolatedEntity } from "../interpolation/interpolate.js";

export const PLAYER_LOOT_CHEST_DEF_ID = "player-loot-chest";

export function nearestLootChest(
  connection: Pick<Connection, "body" | "entities">,
): EntitySnapshot | null {
  const body = connection.body;
  if (!body) return null;
  return lootChestCandidates(connection, body).reduce(selectNearestChest, null)?.snapshot ?? null;
}

export function nearestLootChestFromFrame(
  body: NonNullable<Connection["body"]>,
  entities: readonly Pick<InterpolatedEntity, "snap" | "x" | "y" | "z">[],
): EntitySnapshot | null {
  return entities
    .map((entity) => ({
      snapshot: entity.snap,
      distance: Math.hypot(entity.x - body.x, entity.y - body.y),
      z: entity.z,
    }))
    .filter(({ snapshot, distance, z }) => isNearbyLootChest(snapshot, body, z) && distance <= INTERACT_RANGE)
    .reduce(selectNearestChest, null)?.snapshot ?? null;
}

interface ChestCandidate {
  readonly snapshot: EntitySnapshot;
  readonly distance: number;
  readonly z: number;
}

function lootChestCandidates(connection: Pick<Connection, "entities">, body: NonNullable<Connection["body"]>): ChestCandidate[] {
  return [...connection.entities.values()]
    .map(({ snap }) => ({
      snapshot: snap,
      distance: Math.hypot(snap.x - body.x, snap.y - body.y),
      z: snap.z,
    }))
    .filter(({ snapshot, distance, z }) => isNearbyLootChest(snapshot, body, z) && distance <= INTERACT_RANGE);
}

function selectNearestChest(nearest: ChestCandidate | null, candidate: ChestCandidate): ChestCandidate {
  if (!nearest || candidate.distance < nearest.distance) return candidate;
  return candidate.distance === nearest.distance && candidate.snapshot.id < nearest.snapshot.id ? candidate : nearest;
}

function isNearbyLootChest(
  snapshot: EntitySnapshot,
  body: NonNullable<Connection["body"]>,
  z = snapshot.z,
): boolean {
  return snapshot.kind === "item"
    && snapshot.defId === PLAYER_LOOT_CHEST_DEF_ID
    && Math.abs(z - body.z) <= 1.5;
}


export function lootChestLockSeconds(
  chest: EntitySnapshot,
  serverTick: number,
): number {
  return Math.ceil(Math.max(0, (chest.lootUnlockAtTick ?? 0) - serverTick) / TICK_RATE);
}

export function canOpenLootChest(
  connection: Pick<Connection, "serverTick" | "welcome">,
  chest: EntitySnapshot,
): boolean {
  return lootChestLockSeconds(chest, connection.serverTick) === 0 ||
    chest.lootKillerId === connection.welcome?.playerId;
}

export function activeLootChestNearby(connection: Connection): boolean {
  const chest = nearestLootChest(connection);
  const context = connection.stashContext;
  return context?.kind === "loot"
    ? chest?.id === context.chestId
    : chest !== null;
}
