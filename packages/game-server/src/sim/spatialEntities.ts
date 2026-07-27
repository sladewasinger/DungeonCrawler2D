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
    return bucketPositions(x, y, radius)
      .flatMap(({ x: bucketX, y: bucketY }) => this.buckets.get(bucketKey(bucketX, bucketY)) ?? []);
  }
}

/** Builds one tick-local index in the legacy snapshot ordering. */
export function indexSnapshotEntities(sim: SimState): SpatialEntityIndex {
  const index = new SpatialEntityIndex();
  snapshotEntities(sim).forEach((entity) => index.add(entity));
  return index;
}

function snapshotEntities(sim: SimState): Entity[] {
  return [
    ...[...sim.players.values()].filter((slot) => slot.entity.hp >= 0).map((slot) => slot.entity),
    ...[...sim.enemies.values()].map((enemy) => enemy.entity),
    ...[...sim.pets.values()].map((pet) => pet.entity),
    ...sim.items.values(),
    ...[...sim.lootChests.values()].map((chest) => chest.entity),
    ...sim.projectiles.values(),
    ...sim.torches.values(),
  ];
}

function bucketPositions(x: number, y: number, radius: number): Array<{ x: number; y: number }> {
  const minX = Math.floor((x - radius) / ENTITY_BUCKET_SIZE);
  const maxX = Math.floor((x + radius) / ENTITY_BUCKET_SIZE);
  const minY = Math.floor((y - radius) / ENTITY_BUCKET_SIZE);
  const maxY = Math.floor((y + radius) / ENTITY_BUCKET_SIZE);
  return Array.from({ length: maxY - minY + 1 }, (_, row) => minY + row)
    .flatMap((bucketY) => Array.from({ length: maxX - minX + 1 }, (_, column) => ({
      x: minX + column,
      y: bucketY,
    })));
}

function bucketKey(x: number, y: number): string {
  return `${x},${y}`;
}
