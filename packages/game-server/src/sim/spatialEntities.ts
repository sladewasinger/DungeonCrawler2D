/** Buckets snapshot entities so each player's AOI query visits nearby candidates only. */
import type { Entity } from "@dc2d/engine";
import type { SimState } from "./state.js";

export const ENTITY_BUCKET_SIZE = 16;

interface IndexedEntity {
  entity: Entity;
  order: number;
}

export interface SpatialEntityQuery {
  entities: Entity[];
  candidateScans: number;
}

export class SpatialEntityIndex {
  private readonly buckets = new Map<string, IndexedEntity[]>();
  private readonly ids = new Set<string>();
  private nextOrder = 0;

  add(entity: Entity): void {
    const key = bucketKey(
      Math.floor(entity.body.x / ENTITY_BUCKET_SIZE),
      Math.floor(entity.body.y / ENTITY_BUCKET_SIZE),
    );
    const bucket = this.buckets.get(key);
    const indexed = { entity, order: this.nextOrder++ };
    this.ids.add(entity.id);
    if (bucket) bucket.push(indexed);
    else this.buckets.set(key, [indexed]);
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  queryCircle(x: number, y: number, radius: number): SpatialEntityQuery {
    const candidates = this.candidatesInBounds(x, y, radius);
    candidates.sort((a, b) => a.order - b.order);
    const radiusSquared = radius * radius;
    return {
      entities: candidates
        .filter(({ entity }) =>
          (entity.body.x - x) ** 2 + (entity.body.y - y) ** 2 <= radiusSquared)
        .map(({ entity }) => entity),
      candidateScans: candidates.length,
    };
  }

  private candidatesInBounds(x: number, y: number, radius: number): IndexedEntity[] {
    const minX = Math.floor((x - radius) / ENTITY_BUCKET_SIZE);
    const maxX = Math.floor((x + radius) / ENTITY_BUCKET_SIZE);
    const minY = Math.floor((y - radius) / ENTITY_BUCKET_SIZE);
    const maxY = Math.floor((y + radius) / ENTITY_BUCKET_SIZE);
    const candidates: IndexedEntity[] = [];
    for (let bucketY = minY; bucketY <= maxY; bucketY++) {
      for (let bucketX = minX; bucketX <= maxX; bucketX++) {
        const bucket = this.buckets.get(bucketKey(bucketX, bucketY));
        if (bucket) candidates.push(...bucket);
      }
    }
    return candidates;
  }
}

/** Builds one tick-local index in the legacy snapshot ordering. */
export function indexSnapshotEntities(sim: SimState): SpatialEntityIndex {
  const index = new SpatialEntityIndex();
  for (const slot of sim.players.values()) {
    if (slot.connected && slot.entity.hp >= 0) index.add(slot.entity);
  }
  for (const slot of sim.enemies.values()) index.add(slot.entity);
  for (const item of sim.items.values()) index.add(item);
  for (const projectile of sim.projectiles.values()) index.add(projectile);
  for (const torch of sim.torches.values()) index.add(torch);
  return index;
}

function bucketKey(x: number, y: number): string {
  return `${x},${y}`;
}
