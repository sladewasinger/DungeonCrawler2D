import type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";
import {
  isEntityVisibleFromRoom,
  type RoomEntityVisibility,
} from "./roomEntityVisibility.js";

export type EntityBucketViewpoint = Pick<
  RoomEntityVisibility,
  "viewerX" | "viewerY"
>;

export interface FrameEntityBuckets {
  readonly players: InterpolatedEntity[];
  readonly enemies: InterpolatedEntity[];
  readonly pets: InterpolatedEntity[];
  readonly items: InterpolatedEntity[];
  readonly lootChests: InterpolatedEntity[];
  readonly projectiles: InterpolatedEntity[];
  readonly projectileIds: Set<string>;
  readonly torches: InterpolatedEntity[];
  readonly pickupTargets: InterpolatedEntity[];
}

export function createFrameEntityBuckets(): FrameEntityBuckets {
  return {
    players: [],
    enemies: [],
    pets: [],
    items: [],
    lootChests: [],
    projectiles: [],
    projectileIds: new Set(),
    torches: [],
    pickupTargets: [],
  };
}

/** Partitions a network frame once into scene-owned arrays reused on the next frame. */
export function bucketFrameEntities(
  entities: readonly InterpolatedEntity[],
  buckets: FrameEntityBuckets,
  viewpoint: EntityBucketViewpoint,
): FrameEntityBuckets {
  clearBuckets(buckets);
  for (const entity of entities) {
    if (!isVisibleEntity(viewpoint, entity)) continue;
    bucketEntity(buckets, entity);
  }
  return buckets;
}

function isVisibleEntity(
  viewpoint: EntityBucketViewpoint,
  entity: InterpolatedEntity,
): boolean {
  return isEntityVisibleFromRoom({
    ...viewpoint,
    entityX: entity.x,
    entityY: entity.y,
  });
}

function bucketEntity(buckets: FrameEntityBuckets, entity: InterpolatedEntity): void {
  const handlers: Record<InterpolatedEntity["snap"]["kind"], () => void> = {
    player: () => buckets.players.push(entity), enemy: () => buckets.enemies.push(entity),
    pet: () => buckets.pets.push(entity), item: () => bucketItem(buckets, entity),
    projectile: () => { buckets.projectiles.push(entity); buckets.projectileIds.add(entity.id); },
    torch: () => bucketTorch(buckets, entity),
  };
  handlers[entity.snap.kind]();
}

function bucketItem(buckets: FrameEntityBuckets, entity: InterpolatedEntity): void {
  buckets.items.push(entity);
  (entity.snap.defId === "player-loot-chest" ? buckets.lootChests : buckets.pickupTargets).push(entity);
}

function bucketTorch(buckets: FrameEntityBuckets, entity: InterpolatedEntity): void {
  buckets.torches.push(entity);
  if (entity.snap.state === "placed") buckets.pickupTargets.push(entity);
}

function clearBuckets(buckets: FrameEntityBuckets): void {
  buckets.players.length = 0;
  buckets.enemies.length = 0;
  buckets.pets.length = 0;
  buckets.items.length = 0;
  buckets.lootChests.length = 0;
  buckets.projectiles.length = 0;
  buckets.projectileIds.clear();
  buckets.torches.length = 0;
  buckets.pickupTargets.length = 0;
}
