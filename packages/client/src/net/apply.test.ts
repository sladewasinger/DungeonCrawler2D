// Regression coverage for applySnapshot's floor-transfer world rebuild (wave 8
// integration gate): conn.world must track the CURRENT floor, not just the
// join-time one, or every post-transfer prediction/terrain/stairway-proximity
// read silently uses the wrong floor's chunk geometry.
import { LEVEL, World, type ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { applySnapshot } from "./apply.js";
import { Connection } from "./connection.js";

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

function snapshotAtFloor(floor: number): ServerSnapshot {
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
      hp: 10,
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
