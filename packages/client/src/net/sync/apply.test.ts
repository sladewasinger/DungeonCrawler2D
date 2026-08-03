// Regression coverage for applySnapshot's floor-transfer world rebuild (wave 8
// integration gate): conn.world must track the CURRENT floor, not just the
// join-time one, or every post-transfer prediction/terrain/stairway-proximity
// read silently uses the wrong floor's chunk geometry.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEVEL, World } from "@dc2d/engine";
import { applySnapshot } from "./apply.js";
import { FakeFiniteWorldWorker, freshConnection, snapshotAtFloor, snapshotAtFloorWithArtifact, snapshotAtFloorWithFeatures, WORLD_SEED } from "./applyTestSupport.js";

describe("applySnapshot floor transfer", () => {
  beforeEach(() => vi.stubGlobal("Worker", FakeFiniteWorldWorker));
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeFiniteWorldWorker.responseFloor = undefined;
    FakeFiniteWorldWorker.instance = undefined;
    FakeFiniteWorldWorker.lastRequest = undefined;
  });

  it("rebuilds conn.world asynchronously with the new floor (same seed/level) when self.floor changes", async () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const before = conn.world;
    FakeFiniteWorldWorker.responseFloor = new World(WORLD_SEED, 2, LEVEL.Dungeon).generatedFloor!;

    applySnapshot(conn, snapshotAtFloor(2));
    expect(conn.world).toBeNull();
    expect(conn.worldLoading).toBe(true);
    FakeFiniteWorldWorker.instance?.respond();
    await Promise.resolve();
    await Promise.resolve();

    expect(conn.floor).toBe(2);
    expect(conn.world).not.toBe(before);
    expect(conn.world?.floor).toBe(2);
    expect(conn.world?.worldSeed).toBe(WORLD_SEED);
    expect(conn.world?.level).toBe(LEVEL.Dungeon);
  }, 30_000);

  it("notifies the gameplay loading surface during a floor transition", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const onWorldLoading = vi.fn();
    conn.onWorldLoading = onWorldLoading;

    applySnapshot(conn, snapshotAtFloor(2));

    expect(onWorldLoading).toHaveBeenCalledTimes(1);
  });

  it("acknowledges an accepted transition before destination preparation completes", () => {
    const conn = freshConnection(1);
    const onWorldLoading = vi.fn();
    conn.onWorldLoading = onWorldLoading;
    const snapshot = snapshotAtFloor(1);
    snapshot.events = [{ t: "floorTransition", floor: 2 }];

    applySnapshot(conn, snapshot);

    expect(conn.pendingFloorTransition).toBe(2);
    expect(conn.worldReady).toBe(false);
    expect(conn.worldLoading).toBe(true);
    expect(conn.canAct).toBe(false);
    expect(onWorldLoading).toHaveBeenCalledTimes(1);

    const stale = snapshotAtFloor(1);
    stale.self.x = 99;
    applySnapshot(conn, stale);
    expect(conn.body?.x).toBe(0);
  });

  it("does not replace conn.world's identity when the floor is unchanged (avoids re-triggering ensureWorldBoundSystems every snapshot)", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const before = conn.world;

    applySnapshot(conn, snapshotAtFloor(1));

    expect(conn.world).toBe(before);
  });

  it("preserves the server-selected world features across floor changes", async () => {
    const conn = freshConnection(1);
    conn.world = new World(WORLD_SEED, 1, {
      level: LEVEL.Dungeon, features: { voidTerrain: false },
    });
    conn.hasReceivedSnapshot = true;

    FakeFiniteWorldWorker.responseFloor = new World(WORLD_SEED, 2, {
      level: LEVEL.Dungeon, features: { voidTerrain: false },
    }).generatedFloor!;
    applySnapshot(conn, snapshotAtFloorWithFeatures(2, { voidTerrain: false }));
    FakeFiniteWorldWorker.instance?.respond();
    await Promise.resolve();
    await Promise.resolve();

    expect(conn.world?.features).toEqual({ voidTerrain: false });
  }, 30_000);

  it("passes the authoritative destination artifact to the worker", async () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    FakeFiniteWorldWorker.responseFloor = new World(WORLD_SEED, 2, LEVEL.Dungeon).generatedFloor!;
    const artifact = "gzip-base64-v1:destination-artifact";

    applySnapshot(conn, snapshotAtFloorWithArtifact(2, artifact));

    expect(FakeFiniteWorldWorker.lastRequest?.finiteFloorArtifact).toBe(artifact);
    FakeFiniteWorldWorker.instance?.respond();
    await Promise.resolve();
    await Promise.resolve();
    expect(conn.world?.floor).toBe(2);
  }, 30_000);

  it("rejects a destination floor whose worker data has a different identity", async () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const before = conn.world;
    if (!before) throw new Error("freshConnection must create a world");
    const snapshot = snapshotAtFloor(2);
    const generation = before.floorIdentity;
    if (!generation) throw new Error("freshConnection must create a floor identity");
    snapshot.self.generation = generation;

    FakeFiniteWorldWorker.responseFloor = new World(WORLD_SEED, 2, LEVEL.Dungeon).generatedFloor!;
    applySnapshot(conn, snapshot);
    FakeFiniteWorldWorker.instance?.respond();
    await Promise.resolve();
    await Promise.resolve();

    expect(conn.world).toBeNull();
    expect(conn.worldLoadError).toContain("generation identity mismatch");
    expect(conn.floor).toBe(2);
  });

});

describe("applySnapshot respawn detection (panel round 4, LANE B spawn-grace ring)", () => {
  it("tracks the authoritative respawn deadline and clears it after respawn", () => {
    const conn = freshConnection(1);
    applySnapshot(conn, snapshotAtFloor(1, 0, 601));
    expect(conn.respawnAtTick).toBe(601);
    expect(conn.respawnSecondsRemaining).toBe(30);

    applySnapshot(conn, snapshotAtFloor(1, 10));
    expect(conn.respawnAtTick).toBeNull();
  });

  it("flags justRespawned when hp climbs back from <=0 (respawnSlot's full-hp reset)", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    applySnapshot(conn, snapshotAtFloor(1, 0));
    expect(conn.justRespawned).toBe(false);

    applySnapshot(conn, snapshotAtFloor(1, 10));

    expect(conn.justRespawned).toBe(true);
  });

  it("does not flag justRespawned on an ordinary damage tick (hp staying > 0)", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    // Establishes a live, already-spawned connection first (this initial snapshot is
    // itself a "fresh join" edge case — see the dedicated test below); reset the flag
    // before exercising the actual behavior under test.
    applySnapshot(conn, snapshotAtFloor(1, 10));
    conn.justRespawned = false;

    applySnapshot(conn, snapshotAtFloor(1, 6));

    expect(conn.justRespawned).toBe(false);
  });

  it("flags justRespawned on a brand-new connection's very first snapshot (fresh join, also grace-eligible server-side)", () => {
    const conn = freshConnection(1);

    applySnapshot(conn, snapshotAtFloor(1, 10));

    expect(conn.justRespawned).toBe(true);
  });
});

describe("applySnapshot prediction correction", () => {
  it("records reconciliation error and preserves the pre-correction render pose", () => {
    const conn = freshConnection(1);
    if (!conn.body) throw new Error("freshConnection must create a body");
    conn.body = { ...conn.body, x: 0.5, y: -0.25, z: 0.1 };

    applySnapshot(conn, snapshotAtFloor(1, 10));

    expect(conn.predictionCorrection.advance(0)).toEqual({ x: 0.5, y: -0.25, z: 0.1 });
    expect(conn.networkMetrics.snapshot(performance.now()).maximumCorrectionError)
      .toBeCloseTo(Math.hypot(0.5, -0.25, 0.1));
  });
});
