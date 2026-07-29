import type { EntitySnapshotDeltaEntry, ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim, teleport } from "../integration/support.js";

const OIL_AREA_DEF = "area-oil";
const FIRE_AREA_DEF = "area-fire";
const POISON_AREA_DEF = "area-poison";

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

function nextDelta(sim: ReturnType<typeof makeSim>, playerId: string): ServerSnapshotDelta {
  for (let attempts = 0; attempts < 2; attempts++) {
    const snapshot = sim.stepReplicated().get(playerId);
    if (snapshot) return asDelta(snapshot);
  }
  throw new Error("snapshot cadence exceeded two ticks");
}

describe("snapshot delta replication", () => {
  it("backfills an unchanged compound area after its AOI leaves and re-enters", () => {
    const sim = makeSim(1234, { testFixtures: false, freezeEnemies: true });
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const x = Math.floor(player.spawn.x);
    const y = Math.floor(player.spawn.y);
    const compound = {
      x,
      y,
      defId: FIRE_AREA_DEF,
      layers: [OIL_AREA_DEF, FIRE_AREA_DEF],
    };

    sim.step();
    sim.areas.place({ defId: OIL_AREA_DEF, x, y, steps: 0 });
    sim.areas.place({ defId: FIRE_AREA_DEF, x, y, steps: 0 });
    expect(sim.step().get(player.playerId)?.areas).toContainEqual(compound);

    teleport({ entity, x: x + 120.5, y: y + 0.5, sim });
    sim.step();
    teleport({ entity, x: x + 0.5, y: y + 0.5, sim });

    expect(sim.step().get(player.playerId)?.areas).toContainEqual(compound);
  });

  it("backfills an area created before the player enters its AOI", () => {
    const sim = makeSim(1234, { testFixtures: false, freezeEnemies: true });
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const x = Math.floor(player.spawn.x);
    const y = Math.floor(player.spawn.y);

    teleport({ entity, x: x + 120.5, y: y + 0.5, sim });
    sim.step();
    sim.areas.place({ defId: POISON_AREA_DEF, x, y, steps: 0 });

    expect(sim.step().get(player.playerId)?.areas).not.toContainEqual({
      x,
      y,
      defId: POISON_AREA_DEF,
    });

    teleport({ entity, x: x + 0.5, y: y + 0.5, sim });

    expect(sim.step().get(player.playerId)?.areas).toContainEqual({
      x,
      y,
      defId: POISON_AREA_DEF,
    });
  });

  it("replicates the character skin selected during the hello handshake", () => {
    const sim = makeSim();
    const observer = sim.addPlayer({ name: "Observer", clientId: "skin-observer" });
    const styled = sim.addPlayer({ name: "Styled", clientId: "skin-styled", skin: "wizzard_f" }
    );
    const observerEntity = sim.getPlayerEntity(observer.playerId);
    const styledEntity = sim.getPlayerEntity(styled.playerId);
    if (!observerEntity || !styledEntity) throw new Error("missing test player");
    teleport({ entity: styledEntity, x: observerEntity.body.x + 1, y: observerEntity.body.y, sim: sim });

    const snapshot = sim.step().get(observer.playerId);
    expect(snapshot?.entities).toContainEqual(
      expect.objectContaining({
        id: styled.playerId,
        kind: "player",
        skin: "wizzard_f",
      }),
    );
  });

  it("keeps legacy clients full, then sends revisions, references, and recovery baselines", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "A", clientId: "client-a" });
    const item = sim.spawnItem({ defId: "rag", x: player.spawn.x + 1, y: player.spawn.y });

    const legacy = sim.stepReplicated().get(player.playerId);
    expect(legacy?.type).toBe("snapshot");
    expect(legacy?.self).toMatchObject({
      staminaRecoveryDelaySeconds: 0,
      staminaExhausted: false,
    });

    sim.configureSnapshotMode(player.playerId, "delta-v1");
    const baseline = nextDelta(sim, player.playerId);
    expect(baseline).toMatchObject({
      baseline: true,
      baseTick: null,
      inventory: expect.any(Array),
      hotbar: expect.any(Array),
    });
    expect(entryFor(baseline.entities, item.id)).not.toHaveProperty("unchanged");

    const idle = nextDelta(sim, player.playerId);
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
    const inventoryDelta = nextDelta(sim, player.playerId);
    expect(inventoryDelta.inventoryRevision).toBeGreaterThan(idle.inventoryRevision);
    expect(inventoryDelta.inventory).toContainEqual({ item: "water-flask", qty: 1 });
    expect(inventoryDelta.hotbar).toBeUndefined();

    const areaX = Math.floor(player.spawn.x);
    const areaY = Math.floor(player.spawn.y);
    sim.areas.spawn({ defId: "area-wet", x: areaX, y: areaY, radius: 0 });
    const areaDelta = nextDelta(sim, player.playerId);
    expect(areaDelta.areas).toContainEqual({ x: areaX, y: areaY, defId: "area-wet" });
    sim.stepReplicated();

    sim.requestSnapshotBaseline(player.playerId);
    const recovered = nextDelta(sim, player.playerId);
    expect(recovered.baseline).toBe(true);
    expect(recovered.entities.every((entry) => !("unchanged" in entry))).toBe(true);
    expect(recovered.areas).toContainEqual({ x: areaX, y: areaY, defId: "area-wet" });
  });
});
