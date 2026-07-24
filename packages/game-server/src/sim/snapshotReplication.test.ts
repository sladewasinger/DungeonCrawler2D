import type { EntitySnapshotDeltaEntry, ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim } from "./integration/support.js";

function asDelta(value: unknown): ServerSnapshotDelta {
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "snapshotDelta") {
    throw new Error("expected snapshotDelta");
  }
  return value as ServerSnapshotDelta;
}

function entryFor(entries: EntitySnapshotDeltaEntry[], id: string): EntitySnapshotDeltaEntry {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`missing entity ${id}`);
  return entry;
}

describe("snapshot delta replication", () => {
  it("keeps legacy clients full, then sends revisions, references, and recovery baselines", () => {
    const sim = makeSim();
    const player = sim.addPlayer("A", "client-a");
    const item = sim.spawnItem("rag", player.spawn.x + 1, player.spawn.y);

    expect(sim.stepReplicated().get(player.playerId)?.type).toBe("snapshot");

    sim.configureSnapshotMode(player.playerId, "delta-v1");
    const baseline = asDelta(sim.stepReplicated().get(player.playerId));
    expect(baseline).toMatchObject({
      baseline: true,
      baseTick: null,
      inventory: expect.any(Array),
      hotbar: expect.any(Array),
    });
    expect(entryFor(baseline.entities, item.id)).not.toHaveProperty("unchanged");

    const idle = asDelta(sim.stepReplicated().get(player.playerId));
    expect(idle).toMatchObject({
      baseline: false,
      baseTick: baseline.tick,
      inventoryRevision: baseline.inventoryRevision,
      hotbarRevision: baseline.hotbarRevision,
    });
    expect(idle.inventory).toBeUndefined();
    expect(idle.hotbar).toBeUndefined();
    expect(entryFor(idle.entities, item.id)).toMatchObject({ unchanged: true });
    expect(JSON.stringify(idle).length).toBeLessThan(JSON.stringify(baseline).length);

    sim.getInventory(player.playerId)?.push({ item: "water-flask", qty: 1 });
    const inventoryDelta = asDelta(sim.stepReplicated().get(player.playerId));
    expect(inventoryDelta.inventoryRevision).toBeGreaterThan(idle.inventoryRevision);
    expect(inventoryDelta.inventory).toContainEqual({ item: "water-flask", qty: 1 });
    expect(inventoryDelta.hotbar).toBeUndefined();

    const areaX = Math.floor(player.spawn.x);
    const areaY = Math.floor(player.spawn.y);
    sim.areas.spawn("area-wet", areaX, areaY, 0);
    const areaDelta = asDelta(sim.stepReplicated().get(player.playerId));
    expect(areaDelta.areas).toContainEqual({ x: areaX, y: areaY, defId: "area-wet" });
    sim.stepReplicated();

    sim.requestSnapshotBaseline(player.playerId);
    const recovered = asDelta(sim.stepReplicated().get(player.playerId));
    expect(recovered.baseline).toBe(true);
    expect(recovered.entities.every((entry) => !("unchanged" in entry))).toBe(true);
    expect(recovered.areas).toContainEqual({ x: areaX, y: areaY, defId: "area-wet" });
  });
});
