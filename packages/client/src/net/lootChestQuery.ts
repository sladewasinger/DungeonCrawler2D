import { INTERACT_RANGE, TICK_RATE, type EntitySnapshot } from "@dc2d/engine";
import type { Connection } from "./connection.js";

export const PLAYER_LOOT_CHEST_DEF_ID = "player-loot-chest";

export function nearestLootChest(
  connection: Pick<Connection, "body" | "entities">,
): EntitySnapshot | null {
  const body = connection.body;
  if (!body) return null;
  let nearest: EntitySnapshot | null = null;
  let nearestDistance = INTERACT_RANGE;
  for (const { snap } of connection.entities.values()) {
    if (snap.kind !== "item" || snap.defId !== PLAYER_LOOT_CHEST_DEF_ID ||
      Math.abs(snap.z - body.z) > 1.5) continue;
    const distance = Math.hypot(snap.x - body.x, snap.y - body.y);
    if (distance > nearestDistance) continue;
    nearest = snap;
    nearestDistance = distance;
  }
  return nearest;
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
