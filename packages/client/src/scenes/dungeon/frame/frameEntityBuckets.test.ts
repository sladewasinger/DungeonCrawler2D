import {
  CHUNK_SIZE,
  personalRoomChunk,
  type EntitySnapshot,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";
import {
  bucketFrameEntities,
  createFrameEntityBuckets,
} from "./frameEntityBuckets.js";

function entity(id: string, snap: EntitySnapshot): InterpolatedEntity {
  return { id, snap, x: snap.x, y: snap.y, z: snap.z };
}

function roomEntities(suffix: string, x: number, y: number): InterpolatedEntity[] {
  return [
    entity(`p-${suffix}`, { id: `p-${suffix}`, kind: "player", x, y, z: 0 }),
    entity(`e-${suffix}`, { id: `e-${suffix}`, kind: "enemy", x, y, z: 0 }),
    entity(`pet-${suffix}`, { id: `pet-${suffix}`, kind: "pet", x, y, z: 0 }),
    entity(`i-${suffix}`, { id: `i-${suffix}`, kind: "item", x, y, z: 0 }),
    entity(`r-${suffix}`, { id: `r-${suffix}`, kind: "projectile", x, y, z: 0 }),
    entity(`t-${suffix}`, { id: `t-${suffix}`, kind: "torch", state: "placed", x, y, z: 0 }),
  ];
}

describe("bucketFrameEntities", () => {
  it("classifies one mixed frame and exposes only interactable pickup targets", () => {
    const player = entity("p", { id: "p", kind: "player", x: 0, y: 0, z: 0 });
    const enemy = entity("e", { id: "e", kind: "enemy", x: 1, y: 0, z: 0 });
    const item = entity("i", { id: "i", kind: "item", x: 2, y: 0, z: 0 });
    const projectile = entity("r", { id: "r", kind: "projectile", x: 3, y: 0, z: 0 });
    const placedTorch = entity("tp", { id: "tp", kind: "torch", state: "placed", x: 4, y: 0, z: 0 });
    const flyingTorch = entity("tf", { id: "tf", kind: "torch", state: "flying", x: 5, y: 0, z: 0 });
    const buckets = bucketFrameEntities(
      [player, enemy, item, projectile, placedTorch, flyingTorch],
      createFrameEntityBuckets(),
      { viewerX: 0, viewerY: 0 },
    );

    expect(buckets.players).toEqual([player]);
    expect(buckets.enemies).toEqual([enemy]);
    expect(buckets.items).toEqual([item]);
    expect(buckets.projectiles).toEqual([projectile]);
    expect([...buckets.projectileIds]).toEqual(["r"]);
    expect(buckets.torches).toEqual([placedTorch, flyingTorch]);
    expect(buckets.pickupTargets).toEqual([item, placedTorch]);
  });

  it("reuses and clears every collection across sustained frames", () => {
    const buckets = createFrameEntityBuckets();
    const identities = {
      players: buckets.players,
      enemies: buckets.enemies,
      items: buckets.items,
      projectiles: buckets.projectiles,
      projectileIds: buckets.projectileIds,
      torches: buckets.torches,
      pickupTargets: buckets.pickupTargets,
    };
    const player = entity("p", { id: "p", kind: "player", x: 0, y: 0, z: 0 });

    for (let frame = 0; frame < 300; frame++) {
      bucketFrameEntities(
        frame % 2 === 0 ? [player] : [],
        buckets,
        { viewerX: 0, viewerY: 0 },
      );
      expect(buckets.players).toBe(identities.players);
      expect(buckets.enemies).toBe(identities.enemies);
      expect(buckets.items).toBe(identities.items);
      expect(buckets.projectiles).toBe(identities.projectiles);
      expect(buckets.projectileIds).toBe(identities.projectileIds);
      expect(buckets.torches).toBe(identities.torches);
      expect(buckets.pickupTargets).toBe(identities.pickupTargets);
    }

    expect(buckets.players).toHaveLength(0);
    expect(buckets.projectileIds).toHaveLength(0);
  });

  it("excludes every replicated visual category outside the current room chunk", () => {
    const room = personalRoomChunk(0);
    const insideX = room.cx * CHUNK_SIZE + 4;
    const insideY = room.cy * CHUNK_SIZE + 4;
    const outsideX = insideX + CHUNK_SIZE;
    const inside = roomEntities("in", insideX, insideY);
    const outside = roomEntities("out", outsideX, insideY);
    const buckets = bucketFrameEntities(
      [...inside, ...outside],
      createFrameEntityBuckets(),
      { viewerX: insideX, viewerY: insideY },
    );

    expect([
      ...buckets.players,
      ...buckets.enemies,
      ...buckets.pets,
      ...buckets.items,
      ...buckets.projectiles,
      ...buckets.torches,
    ].map(({ id }) => id)).toEqual(inside.map(({ id }) => id));
    expect(buckets.pickupTargets.map(({ id }) => id)).toEqual(["i-in", "t-in"]);
  });
});
