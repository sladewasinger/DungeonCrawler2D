/** Proves spatial AOI queries match brute force while avoiding global scans. */
import { createBody, makeEntity, type Entity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { SpatialEntityIndex } from "./spatialEntities.js";

function entity(id: string, x: number, y: number): Entity {
  return makeEntity("item", createBody(x, y, 0), { id, hp: 1, maxHp: 1 });
}

describe("SpatialEntityIndex", () => {
  it("matches exact-circle brute force and preserves insertion order across negative buckets", () => {
    const entities = [
      entity("outside", 20, 20),
      entity("west", -3, 0),
      entity("edge", 5, 0),
      entity("north", 0, -4),
      entity("east", 2, 1),
    ];
    const index = new SpatialEntityIndex();
    for (const candidate of entities) index.add(candidate);

    const query = index.queryCircle(0, 0, 5);
    const bruteForce = entities.filter(({ body }) => body.x ** 2 + body.y ** 2 <= 25);

    expect(query.entities.map(({ id }) => id)).toEqual(bruteForce.map(({ id }) => id));
  });

  it("scans only nearby buckets in a dense world", () => {
    const index = new SpatialEntityIndex();
    const entities: Entity[] = [];
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const candidate = entity(`${x}:${y}`, x * 4, y * 4);
        entities.push(candidate);
        index.add(candidate);
      }
    }

    const query = index.queryCircle(200, 200, 20);
    const bruteForce = entities.filter(({ body }) =>
      (body.x - 200) ** 2 + (body.y - 200) ** 2 <= 400);

    expect(query.entities.map(({ id }) => id)).toEqual(bruteForce.map(({ id }) => id));
    expect(query.entities).toHaveLength(81);
    expect(query.candidateScans).toBe(144);
  });
});
