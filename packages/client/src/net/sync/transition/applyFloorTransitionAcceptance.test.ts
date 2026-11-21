import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../apply.js";
import { beginFloorTransition } from "./applyFloorTransitionEvent.js";
import {
  FakeFiniteWorldWorker,
  freshConnection,
  snapshotAtFloorWithGeneration,
} from "../applyTestSupport.js";

describe("cold floor transition acceptance", () => {
  beforeEach(() => vi.stubGlobal("Worker", FakeFiniteWorldWorker));
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeFiniteWorldWorker.responseFloor = undefined;
    FakeFiniteWorldWorker.instance = undefined;
    FakeFiniteWorldWorker.instances = [];
  });

  it("ignores a superseded worker result without replacing newer loading state", async () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    FakeFiniteWorldWorker.responseFloor = conn.world?.generatedFloor ?? undefined;
    const generation = conn.world?.floorIdentity;
    if (!generation) throw new Error("fresh connection needs a floor identity");

    applySnapshot(conn, snapshotAtFloorWithGeneration(2, generation));
    beginFloorTransition(conn, 3);
    FakeFiniteWorldWorker.instance?.respond();
    await Promise.resolve();
    await Promise.resolve();

    expect(conn.world).toBeNull();
    expect(conn.worldLoading).toBe(true);
    expect(conn.worldLoadError).toBeNull();
    expect(conn.pendingFloorTransition).toBe(3);
  });

  it("cancels the prior load and ignores its late resolve and reject", async () => {
    const { conn, first, second } = startTwoUnresolvedLoads();
    expect(first.terminated).toBe(true);
    expect(second.terminated).toBe(false);

    first.respond();
    first.reject("stale destination failure");
    await Promise.resolve();
    await Promise.resolve();

    expect(conn.world).toBeNull();
    expect(conn.worldLoading).toBe(true);
    expect(conn.worldLoadError).toBeNull();
    expect(second.terminated).toBe(false);
  });
});

function startTwoUnresolvedLoads() {
  const conn = freshConnection(1);
  conn.hasReceivedSnapshot = true;
  const currentWorld = conn.world;
  if (!currentWorld?.generatedFloor || !currentWorld.floorIdentity) {
    throw new Error("fresh connection needs a floor identity");
  }
  FakeFiniteWorldWorker.responseFloor = currentWorld.generatedFloor;
  applySnapshot(conn, snapshotAtFloorWithGeneration(2, currentWorld.floorIdentity));
  conn.world = currentWorld;
  applySnapshot(conn, snapshotAtFloorWithGeneration(3, currentWorld.floorIdentity));
  const [first, second] = FakeFiniteWorldWorker.instances;
  if (!first || !second) throw new Error("expected two finite world workers");
  return { conn, first, second };
}
