import {
  AOI_RADIUS,
  MIN_SPAWN_DIST,
  RECONNECT_GRACE_MS,
  TICK_RATE,
  World,
  hashString,
  type ClientInput,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "./sim";

/**
 * Headless multi-client simulation tests: this drives the exact sim
 * the ws server runs in production, minus the sockets — the "local
 * test that mimics the server" for Epic 2.
 */

const SEED = hashString("sim-test-world");

function input(seq: number, moveX: -1 | 0 | 1, moveY: -1 | 0 | 1, jump = false): ClientInput {
  return { type: "input", seq, moveX, moveY, jump };
}

describe("GameSim", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = new GameSim(new World(SEED, 1), 1234);
  });

  it("spawns players far apart — distance is the protection", () => {
    const joins = [sim.addPlayer("A"), sim.addPlayer("B"), sim.addPlayer("C")];
    for (let i = 0; i < joins.length; i++) {
      for (let j = i + 1; j < joins.length; j++) {
        const a = joins[i]!.spawn;
        const b = joins[j]!.spawn;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_SPAWN_DIST);
      }
    }
  });

  it("spawns on walkable ground at terrain height", () => {
    const { spawn } = sim.addPlayer("A");
    expect(sim.world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
    expect(spawn.z).toBeCloseTo(
      sim.world.heightAt(Math.floor(spawn.x), Math.floor(spawn.y)),
      5,
    );
  });

  it("applies inputs authoritatively and echoes lastSeq", () => {
    const { playerId, spawn } = sim.addPlayer("A");
    sim.handleInput(playerId, input(1, 1, 0));
    const snapshots = sim.step();
    const snap = snapshots.get(playerId)!;
    expect(snap.lastSeq).toBe(1);
    // Moved east or was wall-blocked — but never teleported.
    expect(snap.self.x).toBeGreaterThanOrEqual(spawn.x);
    expect(snap.self.x - spawn.x).toBeLessThanOrEqual(1);
  });

  it("ignores stale or replayed input sequence numbers", () => {
    const { playerId } = sim.addPlayer("A");
    sim.handleInput(playerId, input(5, 1, 0));
    sim.step();
    sim.handleInput(playerId, input(5, 1, 0)); // replay
    sim.handleInput(playerId, input(4, 1, 0)); // stale
    const snap = sim.step().get(playerId)!;
    expect(snap.lastSeq).toBe(5);
  });

  it("replicates only within the area of interest", () => {
    const a = sim.addPlayer("A");
    const b = sim.addPlayer("B");
    // Spawned ≥ MIN_SPAWN_DIST apart, which exceeds AOI_RADIUS.
    expect(MIN_SPAWN_DIST).toBeGreaterThan(AOI_RADIUS);
    let snap = sim.step().get(a.playerId)!;
    expect(snap.others).toHaveLength(0);

    // Teleport B next to A (test-only mutation of authoritative state).
    const bodyA = sim.getBody(a.playerId)!;
    const bodyB = sim.getBody(b.playerId)!;
    bodyB.x = bodyA.x + 2;
    bodyB.y = bodyA.y;
    bodyB.z = bodyA.z;
    snap = sim.step().get(a.playerId)!;
    expect(snap.others.map((o) => o.id)).toEqual([b.playerId]);
    expect(snap.others[0]!.name).toBe("B");

    // Move B far away again → A gets a `left` notice exactly once.
    bodyB.x = bodyA.x + AOI_RADIUS * 3;
    snap = sim.step().get(a.playerId)!;
    expect(snap.others).toHaveLength(0);
    expect(snap.left).toEqual([b.playerId]);
    snap = sim.step().get(a.playerId)!;
    expect(snap.left).toEqual([]);
  });

  it("keeps disconnected players through the grace window, then reaps", () => {
    const a = sim.addPlayer("A");
    const b = sim.addPlayer("B");
    const bodyA = sim.getBody(a.playerId)!;
    const bodyB = sim.getBody(b.playerId)!;
    bodyB.x = bodyA.x + 2;
    bodyB.y = bodyA.y;
    sim.step();

    sim.markDisconnected(b.playerId);
    // Disconnected players get no snapshot but still exist in the world.
    let snapshots = sim.step();
    expect(snapshots.has(b.playerId)).toBe(false);
    expect(snapshots.get(a.playerId)!.others.map((o) => o.id)).toEqual([b.playerId]);

    // After the grace window they are reaped.
    const graceTicks = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);
    for (let i = 0; i < graceTicks + 2; i++) snapshots = sim.step();
    expect(snapshots.get(a.playerId)!.others).toHaveLength(0);
    expect(sim.playerCount).toBe(1);
  });

  it("resumes a disconnected player by token, preserving position", () => {
    const a = sim.addPlayer("A");
    sim.handleInput(a.playerId, input(1, 1, 0));
    sim.step();
    const before = { ...sim.getBody(a.playerId)! };

    sim.markDisconnected(a.playerId);
    sim.step();

    const resumed = sim.addPlayer("A", a.resumeToken);
    expect(resumed.resumed).toBe(true);
    expect(resumed.playerId).toBe(a.playerId);
    expect(resumed.spawn.x).toBeCloseTo(before.x, 5);
    expect(sim.playerCount).toBe(1);
  });

  it("issues a fresh identity when the resume token is expired", () => {
    const a = sim.addPlayer("A");
    sim.markDisconnected(a.playerId);
    const graceTicks = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);
    for (let i = 0; i < graceTicks + 2; i++) sim.step();

    const rejoined = sim.addPlayer("A", a.resumeToken);
    expect(rejoined.resumed).toBe(false);
    expect(rejoined.playerId).not.toBe(a.playerId);
  });

  it("three clients converge on the same world state (headless end-to-end)", () => {
    // The Epic 2 acceptance test, transport-free: three players, two
    // adjacent and one far away; the adjacent pair see each other move
    // tick by tick, the distant one sees nobody.
    const a = sim.addPlayer("A");
    const b = sim.addPlayer("B");
    const c = sim.addPlayer("C");
    const bodyA = sim.getBody(a.playerId)!;
    const bodyB = sim.getBody(b.playerId)!;
    bodyB.x = bodyA.x + 5;
    bodyB.y = bodyA.y;
    bodyB.z = bodyA.z;
    sim.step();

    let seq = 0;
    for (let tick = 0; tick < 10; tick++) {
      sim.handleInput(a.playerId, input(++seq, 0, 0, false));
      const snapshots = sim.step();
      const aSees = snapshots.get(a.playerId)!;
      const bSees = snapshots.get(b.playerId)!;
      const cSees = snapshots.get(c.playerId)!;
      // A and B agree on each other's authoritative positions.
      expect(aSees.others.find((o) => o.id === b.playerId)!.x).toBeCloseTo(
        bSees.self.x,
        10,
      );
      expect(bSees.others.find((o) => o.id === a.playerId)!.x).toBeCloseTo(
        aSees.self.x,
        10,
      );
      // C, far away, sees no one.
      expect(cSees.others).toHaveLength(0);
    }
  });
});
