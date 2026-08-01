import {
  ATTACK_COOLDOWN_MS,
  INTERACT_RANGE,
  PICKUP_RANGE,
  findWorldInteractionTarget,
  resolveWorldInteraction,
} from "@dc2d/engine";
import type { InputQueries } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { RemoteEntity } from "../../../net/interpolation/interpolate.js";
import { canOpenLootChest, nearestLootChest } from "../../../net/queries/lootChestQuery.js";
import {
  isConsumableItem,
  isThrowableItem,
  nearestDownedPartyMember,
  nearestEntity,
  nearestEntityId,
  recipeIdAtIndex,
  weaponCooldownMs,
} from "../world/contentQueries.js";
import { resolveStairwayPrompt } from "../world/stairwayProximity.js";

function positionedEntities(conn: Connection): Array<{
  id: string;
  kind: string;
  x: number;
  y: number;
}> {
  return [...conn.entities.entries()]
    .filter(([, remote]) => remote.snap.hp === undefined || remote.snap.hp > 0)
    .map(([id, remote]) => ({
      id,
      kind: remote.snap.kind,
      x: remote.snap.x,
      y: remote.snap.y,
    }));
}

export function createInputQueries(conn: Connection): InputQueries {
  return { ...inputContentQueries(conn), ...inputProximityQueries(conn) };
}

function inputContentQueries(conn: Connection): Pick<
  InputQueries,
  "isThrowable" | "isConsumable" | "attackCooldownMs" | "recipeIdAt" |
  "nearestPlayerId" | "nearestEnemyDirection"
> {
  return {
    isThrowable: isThrowableItem,
    isConsumable: isConsumableItem,
    attackCooldownMs: (weaponId) => weaponCooldownMs(weaponId, ATTACK_COOLDOWN_MS),
    recipeIdAt: recipeIdAtIndex,
    nearestPlayerId: (adapter, maxDistance) => adapter.body
      ? nearestEntityId({ entities: positionedEntities(conn), kind: "player", fromX: adapter.body.x, fromY: adapter.body.y, maxDistance })
      : undefined,
    nearestEnemyDirection: (adapter, maxDistance) => {
      if (!adapter.body) return undefined;
      const enemy = nearestEntity({
        entities: positionedEntities(conn),
        kind: "enemy",
        fromX: adapter.body.x,
        fromY: adapter.body.y,
        maxDistance,
      });
      return enemy
        ? { x: enemy.x - adapter.body.x, y: enemy.y - adapter.body.y }
        : undefined;
    },
  };
}

function inputProximityQueries(conn: Connection): Pick<InputQueries, "nearbyLootChest" | "isStashNearby" | "isCraftTableNearby" | "worldInteraction" | "isStairwayNearby" | "downedPartyMemberInRange" | "isAdoptablePetNearby" | "isPickupNearby"> {
  return {
    nearbyLootChest: () => {
      const chest = nearestLootChest(conn);
      return chest ? { id: chest.id, canOpen: canOpenLootChest(conn, chest) } : undefined;
    },
    isStashNearby: (adapter) => !!nearestLootChest(conn) || isNearbyInteraction(conn, adapter.body ?? undefined, "stash"),
    isCraftTableNearby: (adapter) => isNearbyInteraction(conn, adapter.body ?? undefined, "craft"),
    worldInteraction: (adapter) => conn.world && adapter.body
      ? resolveWorldInteraction(conn.world, adapter.body.x, adapter.body.y) : null,
    isStairwayNearby: (adapter) => !!conn.world && !!adapter.body && !!resolveStairwayPrompt(conn.world, adapter.body.x, adapter.body.y),
    downedPartyMemberInRange: (adapter) => downedPartyMemberInRange(conn, adapter.body ?? undefined),
    isAdoptablePetNearby: (adapter) => hasNearbyEntity({
      conn, body: adapter.body ?? undefined,
      predicate: (remote) => remote.snap.kind === "pet" && remote.snap.petOwnerName === undefined,
      range: INTERACT_RANGE,
    }),
    isPickupNearby: (adapter) => hasNearbyEntity({
      conn, body: adapter.body ?? undefined,
      predicate: (remote) => (remote.snap.kind === "item" && remote.snap.defId !== "player-loot-chest")
        || (remote.snap.kind === "torch" && remote.snap.state === "placed"),
      range: PICKUP_RANGE,
    }),
  };
}

interface NearbyEntityRequest {
  readonly conn: Connection;
  readonly body: { x: number; y: number } | undefined;
  readonly predicate: (remote: RemoteEntity) => boolean;
  readonly range: number;
}

function hasNearbyEntity(request: NearbyEntityRequest): boolean {
  const { conn, body, predicate, range } = request;
  if (!body) return false;
  return [...conn.entities.values()].some((remote) => predicate(remote)
    && Math.hypot(remote.snap.x - body.x, remote.snap.y - body.y) <= range);
}

function isNearbyInteraction(conn: Connection, body: { x: number; y: number } | undefined, kind: "stash" | "craft"): boolean {
  return !!conn.world && !!body && !!findWorldInteractionTarget({ world: conn.world, x: body.x, y: body.y, kind });
}

function downedPartyMemberInRange(conn: Connection, body: { x: number; y: number } | undefined) {
  if (!body) return undefined;
  const members = [...conn.entities.values()]
    .map(({ snap }) => snap)
    .filter((snap) => snap.kind === "player" && snap.downed)
    .map((snap) => ({ id: snap.id, x: snap.x, y: snap.y, downed: true }));
  return nearestDownedPartyMember({ members, fromX: body.x, fromY: body.y, maxDistance: INTERACT_RANGE });
}
