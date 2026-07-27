import { INTERACT_RANGE } from "@dc2d/engine";
import type { Connection } from "../../net/connection.js";
import { nearestLootChest } from "../../net/lootChestQuery.js";
import type { FrameEntityBuckets } from "./frameEntityBuckets.js";
import {
  resolveInteractionPrompt,
  type InteractionPrompt,
} from "./interactionPrompt.js";

function nearestDownedPlayer(
  buckets: FrameEntityBuckets,
  x: number,
  y: number,
): { id: string } | undefined {
  let best: { id: string } | undefined;
  let bestDistance = INTERACT_RANGE;
  for (const player of buckets.players) {
    if (!player.snap.downed) continue;
    const distance = Math.hypot(player.x - x, player.y - y);
    if (isNearerPlayer({ player, best, distance, bestDistance })) {
      best = { id: player.id };
      bestDistance = distance;
    }
  }
  return best;
}

function isNearerPlayer(input: {
  readonly player: { readonly id: string };
  readonly best: { readonly id: string } | undefined;
  readonly distance: number;
  readonly bestDistance: number;
}): boolean {
  const { player, best, distance, bestDistance } = input;
  return distance < bestDistance || (distance === bestDistance && (!best || player.id < best.id));
}

function nearestPet(
  buckets: FrameEntityBuckets,
  x: number,
  y: number,
): { x: number; y: number; name: string } | undefined {
  let best: { x: number; y: number; name: string } | undefined;
  let bestDistance = INTERACT_RANGE;
  for (const pet of buckets.pets) {
    if (pet.snap.petOwnerName !== undefined) continue;
    const distance = Math.hypot(pet.x - x, pet.y - y);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = {
      x: pet.x,
      y: pet.y,
      name: pet.snap.name ?? "pet",
    };
  }
  return best;
}

export function resolveFrameInteractionPrompt(
  conn: Connection,
  buckets: FrameEntityBuckets,
): InteractionPrompt | null {
  if (!conn.world || !conn.body) return null;
  const { x, y } = conn.body;
  return resolveInteractionPrompt({
    world: conn.world, x, y, items: buckets.pickupTargets,
    reviveTarget: nearestDownedPlayer(buckets, x, y),
    lootChest: nearestLootChest(conn) ?? undefined,
    pet: nearestPet(buckets, x, y),
  });
}
