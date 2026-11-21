import { type Entity, type World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import {
  createFloorRegistryFixture,
  disposeFloorRegistryFixture,
} from "./floorRegistryTestSupport.js";

function placeAt(
  entity: Entity,
  position: { readonly x: number; readonly y: number },
  world: Pick<World, "groundAt">,
): void {
  entity.body.x = position.x;
  entity.body.y = position.y;
  entity.body.z = world.groundAt(position.x, position.y);
  entity.body.fallStart = entity.body.z;
  entity.body.grounded = true;
}

describe("FloorRegistry destination artifact handoff", () => {
  it("reuses one prepared authoritative floor for a later join", { timeout: 30_000 }, async () => {
    const clientId = "prewarm-client";
    const store = new PlayerStore(null);
    store.recordActiveFloor(store.get(clientId, "A"), 2);
    const floors = createFloorRegistryFixture({
      floors: [1, 2],
      store,
    });
    try {
      const prepared = await floors.prepareJoinSim(clientId);
      expect(prepared.world.floor).toBe(2);
      expect(floors.finiteFloorArtifact(2)).toMatch(/^gzip-base64-v1:/);
      expect(await floors.prepareJoinSim(clientId)).toBe(prepared);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });

  it("prewarms the authoritative floor-1 to floor-2 to floor-3 artifact chain", { timeout: 60_000 }, async () => {
    const floors = createFloorRegistryFixture({
      prewarmNextFloor: true,
    });
    try {
      expect(floors.finiteFloorArtifact(1)).toMatch(/^gzip-base64-v1:/);
      await floors.waitForPendingFloorPreparations();
      expect(floors.finiteFloorArtifact(2)).toMatch(/^gzip-base64-v1:/);
      const join = floors.base.addPlayer({ name: "A", clientId: "advance-prewarm" });
      const entity = floors.base.getPlayerEntity(join.playerId)!;
      const down = floors.base.world.downStairwayPositions()[0]!;
      placeAt(entity, down, floors.base.world);
      floors.base.queueAction(join.playerId, { type: "descend" });

      const moved = floors.stepAll().moved;
      expect(moved.some((entry) => entry.playerId === join.playerId && entry.sim.world.floor === 2)).toBe(true);
      await floors.waitForPendingFloorPreparations();
      expect(floors.finiteFloorArtifact(3)).toMatch(/^gzip-base64-v1:/);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });

  it("hands the prepared artifact through the first arrival snapshot", { timeout: 30_000 }, async () => {
    const floors = createFloorRegistryFixture({ floors: [1] });
    try {
      const join = floors.base.addPlayer({ name: "A", clientId: "client-a" });
      const entity = floors.base.getPlayerEntity(join.playerId)!;
      const down = floors.base.world.downStairwayPositions()[0]!;
      placeAt(entity, down, floors.base.world);
      floors.base.queueAction(join.playerId, { type: "descend" });

      const firstTick = floors.stepAll();
      expect(firstTick.moved).toHaveLength(0);
      await floors.waitForPendingFloorPreparations();
      const moved = floors.stepAll().moved;
      expect(moved.some((entry) =>
        entry.playerId === join.playerId && entry.sim.world.floor === 2
      )).toBe(true);
      const arrival = floors.stepAll().snapshots.get(join.playerId);

      expect(arrival?.self.finiteFloorArtifact).toBe(floors.finiteFloorArtifact(2));
      expect(arrival?.self.finiteFloorArtifact).toMatch(/^gzip-base64-v1:/);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });

  it("prepares a persisted deeper-floor join through the worker", { timeout: 30_000 }, async () => {
    const store = new PlayerStore(null);
    const player = store.get("client-persisted", "A");
    store.recordActiveFloor(player, 2);
    const floors = createFloorRegistryFixture({ floors: [1], store });
    try {
      const joined = await floors.prepareJoinSim("client-persisted");

      expect(joined.world.floor).toBe(2);
      expect(floors.finiteFloorArtifact(2)).toMatch(/^gzip-base64-v1:/);
    } finally {
      await disposeFloorRegistryFixture(floors);
    }
  });
});
