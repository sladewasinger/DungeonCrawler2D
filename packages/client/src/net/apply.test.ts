// Regression coverage for applySnapshot's floor-transfer world rebuild (wave 8
// integration gate): conn.world must track the CURRENT floor, not just the
// join-time one, or every post-transfer prediction/terrain/stairway-proximity
// read silently uses the wrong floor's chunk geometry.
import { LEVEL, World, type ServerSnapshot, type ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { applySnapshot } from "./apply.js";
import { Connection } from "./connection.js";
import { applySnapshotDelta } from "./snapshotDelta.js";

const WORLD_SEED = 12345;

function freshConnection(floor: number): Connection {
  const conn = new Connection("wss://example.test", "Tester", "client-1");
  conn.world = new World(WORLD_SEED, floor, LEVEL.Dungeon);
  conn.body = {
    x: 0,
    y: 0,
    z: 0,
    zVel: 0,
    grounded: true,
    coyoteTime: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    fallStart: 0,
    kx: 0,
    ky: 0,
  };
  return conn;
}

function snapshotAtFloor(floor: number, hp = 10): ServerSnapshot {
  return {
    type: "snapshot",
    tick: 1,
    lastSeq: 0,
    self: {
      x: 0,
      y: 0,
      z: 0,
      zVel: 0,
      grounded: true,
      coyoteTime: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      kx: 0,
      ky: 0,
      hp,
      maxHp: 10,
      fx: [],
      floor,
    },
    inventory: [],
    hotbar: [],
    weapon: null,
    party: null,
    entities: [],
    left: [],
    events: [],
    areas: [],
  };
}

describe("applySnapshot floor transfer", () => {
  it("rebuilds conn.world with the new floor (same seed/level) when self.floor changes", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const before = conn.world;

    applySnapshot(conn, snapshotAtFloor(2));

    expect(conn.floor).toBe(2);
    expect(conn.world).not.toBe(before);
    expect(conn.world?.floor).toBe(2);
    expect(conn.world?.worldSeed).toBe(WORLD_SEED);
    expect(conn.world?.level).toBe(LEVEL.Dungeon);
  });

  it("does not replace conn.world's identity when the floor is unchanged (avoids re-triggering ensureWorldBoundSystems every snapshot)", () => {
    const conn = freshConnection(1);
    conn.hasReceivedSnapshot = true;
    const before = conn.world;

    applySnapshot(conn, snapshotAtFloor(1));

    expect(conn.world).toBe(before);
  });
});

describe("applySnapshot respawn detection (panel round 4, LANE B spawn-grace ring)", () => {
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
  it("records the displacement from the predicted pose to reconciled server truth", () => {
    const conn = freshConnection(1);
    if (!conn.body) throw new Error("freshConnection must create a body");
    conn.body = { ...conn.body, x: 2.5, y: -1.25, z: 0.5 };

    applySnapshot(conn, snapshotAtFloor(1, 10));

    expect(conn.predictionCorrection.consume()).toEqual({ x: -2.5, y: 1.25, z: -0.5 });
  });
});

function deltaAt(
  tick: number,
  baseTick: number | null,
  baseline: boolean,
  areas: ServerSnapshotDelta["areas"] = [],
): ServerSnapshotDelta {
  const full = snapshotAtFloor(1, 10);
  return {
    type: "snapshotDelta",
    tick,
    baseTick,
    baseline,
    lastSeq: full.lastSeq,
    self: full.self,
    inventoryRevision: 1,
    ...(baseline ? { inventory: [{ item: "bandage", qty: 2 }] } : {}),
    hotbarRevision: 1,
    ...(baseline ? { hotbar: ["bandage"] } : {}),
    weapon: full.weapon,
    party: full.party,
    entities: baseline
      ? [{ id: "item-1", kind: "item", defId: "rag", x: 1, y: 2, z: 0, revision: 3 }]
      : [{ id: "item-1", revision: 3, unchanged: true }],
    left: [],
    events: [],
    areas,
  };
}

describe("applySnapshotDelta", () => {
  it("applies known revisions, rejects a missed tick, and recovers from a baseline", () => {
    const conn = freshConnection(1);
    applySnapshotDelta(conn, deltaAt(10, null, true, [
      { x: 0, y: 0, defId: "area-fire" },
    ]));
    expect(conn.inventory).toEqual([{ item: "bandage", qty: 2 }]);
    expect(conn.entities.get("item-1")?.snap.defId).toBe("rag");
    expect(conn.areaTiles.get("0,0")).toBe("area-fire");

    applySnapshotDelta(conn, deltaAt(11, 10, false));
    expect(conn.serverTick).toBe(11);

    applySnapshotDelta(conn, deltaAt(13, 12, false, [
      { x: 0, y: 0, defId: null },
      { x: 1, y: 0, defId: "area-wet" },
    ]));
    expect(conn.serverTick).toBe(11);
    expect(conn.snapshotRevisions.awaitingBaseline).toBe(true);
    expect(conn.areaTiles.get("0,0")).toBe("area-fire");
    expect(conn.areaTiles.has("1,0")).toBe(false);

    applySnapshotDelta(conn, deltaAt(14, null, true, [
      { x: 1, y: 0, defId: "area-wet" },
    ]));
    expect(conn.serverTick).toBe(14);
    expect(conn.snapshotRevisions.awaitingBaseline).toBe(false);
    expect([...conn.areaTiles]).toEqual([["1,0", "area-wet"]]);
  });
});
