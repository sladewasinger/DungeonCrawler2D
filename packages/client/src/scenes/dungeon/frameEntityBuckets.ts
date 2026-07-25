import type { InterpolatedEntity } from "../../net/interpolate.js";

export interface FrameEntityBuckets {
  readonly players: InterpolatedEntity[];
  readonly enemies: InterpolatedEntity[];
  readonly items: InterpolatedEntity[];
  readonly projectiles: InterpolatedEntity[];
  readonly projectileIds: Set<string>;
  readonly torches: InterpolatedEntity[];
  readonly pickupTargets: InterpolatedEntity[];
}

export function createFrameEntityBuckets(): FrameEntityBuckets {
  return {
    players: [],
    enemies: [],
    items: [],
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
): FrameEntityBuckets {
  clearBuckets(buckets);
  for (const entity of entities) {
    switch (entity.snap.kind) {
      case "player":
        buckets.players.push(entity);
        break;
      case "enemy":
        buckets.enemies.push(entity);
        break;
      case "item":
        buckets.items.push(entity);
        buckets.pickupTargets.push(entity);
        break;
      case "projectile":
        buckets.projectiles.push(entity);
        buckets.projectileIds.add(entity.id);
        break;
      case "torch":
        buckets.torches.push(entity);
        if (entity.snap.state === "placed") buckets.pickupTargets.push(entity);
        break;
    }
  }
  return buckets;
}

function clearBuckets(buckets: FrameEntityBuckets): void {
  buckets.players.length = 0;
  buckets.enemies.length = 0;
  buckets.items.length = 0;
  buckets.projectiles.length = 0;
  buckets.projectileIds.clear();
  buckets.torches.length = 0;
  buckets.pickupTargets.length = 0;
}
