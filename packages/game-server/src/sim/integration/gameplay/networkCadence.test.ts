/** Benchmarks idle protocol traffic and verifies multi-client loss recovery under burst movement. */
import {
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  TICK_DT,
  encodeMessage,
  type ServerSnapshotDelta,
  type ServerStateSnapshot,
} from "@dc2d/engine";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { routeAuthenticatedMessage } from "../../../server/dispatch.js";
import type { SocketMap } from "../../../server/types.js";
import type { GameSim } from "../../core/index.js";
import { findFlatArena, input, makeSim, teleport } from "../support.js";

function encodedBytes(snapshots: ServerStateSnapshot[]): number {
  return snapshots.reduce((total, snapshot) => total + Buffer.byteLength(encodeMessage(snapshot)), 0);
}

function asDelta(snapshot: ServerStateSnapshot | undefined): ServerSnapshotDelta {
  if (snapshot?.type !== "snapshotDelta") throw new Error("expected snapshot delta");
  return snapshot;
}

function playerEntity(sim: GameSim, playerId: string) {
  const entity = sim.getPlayerEntity(playerId);
  if (!entity) throw new Error(`missing player ${playerId}`);
  return entity;
}

function collectLegacyIdle(): ServerStateSnapshot[] {
  const sim = makeSim(101, {});
  const player = sim.addPlayer({ name: "Legacy", clientId: "legacy-client" });
  return Array.from({ length: 20 }, () => {
    const snapshot = sim.step().get(player.playerId);
    if (!snapshot) throw new Error("legacy snapshot cadence skipped a tick");
    return snapshot;
  });
}

function collectAdaptiveIdle(): ServerStateSnapshot[] {
  const sim = makeSim(101, {});
  const player = sim.addPlayer({ name: "Adaptive", clientId: "adaptive-client" });
  sim.configureSnapshotMode(player.playerId, "delta-v1");
  const snapshots = [];
  for (let tick = 0; tick < 20; tick++) {
    const snapshot = sim.stepReplicated().get(player.playerId);
    if (snapshot) snapshots.push(snapshot);
  }
  return snapshots;
}

describe("network cadence release", () => {
  it("cuts deterministic idle snapshot messages and bytes by at least forty percent", () => {
    const legacy = collectLegacyIdle();
    const adaptive = collectAdaptiveIdle();

    expect(legacy).toHaveLength(20);
    expect(adaptive).toHaveLength(11);
    expect(encodedBytes(adaptive)).toBeLessThan(encodedBytes(legacy) * 0.6);
  });

  it("bursts moving actors to observers and recovers one dropped delta independently", () => {
    const sim = makeSim(202, {});
    const mover = sim.addPlayer({ name: "Mover", clientId: "client-mover" });
    const observerA = sim.addPlayer({ name: "ObserverA", clientId: "client-a" });
    const observerB = sim.addPlayer({ name: "ObserverB", clientId: "client-b" });
    const arena = findFlatArena({ sim: sim, anchor: { x: mover.spawn.x, y: mover.spawn.y } });
    teleport({ entity: playerEntity(sim, mover.playerId), x: arena.x, y: arena.y, sim: sim });
    teleport({ entity: playerEntity(sim, observerA.playerId), x: arena.x + 1, y: arena.y, sim: sim });
    teleport({ entity: playerEntity(sim, observerB.playerId), x: arena.x - 1, y: arena.y, sim: sim });
    for (const id of [mover.playerId, observerA.playerId, observerB.playerId]) {
      sim.configureSnapshotMode(id, "delta-v1");
    }
    sim.stepReplicated();
    sim.handleInput(mover.playerId, input({ seq: 1, moveX: 1, moveY: 0, jump: true }));

    const beforeMove = playerEntity(sim, mover.playerId).body.x;
    const beforeJump = playerEntity(sim, mover.playerId).body.z;
    const dropped = sim.stepReplicated();
    expect(playerEntity(sim, mover.playerId).body.x).toBeGreaterThan(beforeMove);
    expect(dropped.has(observerA.playerId)).toBe(true);
    const gap = sim.stepReplicated();
    expect(asDelta(gap.get(observerA.playerId)).baseTick).toBe(asDelta(dropped.get(observerA.playerId)).tick);
    const sockets = new Map([
      [observerA.playerId, { ws: {} as WebSocket, sim }],
      [observerB.playerId, { ws: {} as WebSocket, sim }],
    ]) as SocketMap;
    routeAuthenticatedMessage({ type: "snapshotResync" }, observerA.playerId, sockets);

    const recovered = sim.stepReplicated();
    const observerRecovery = asDelta(recovered.get(observerA.playerId));
    const unaffectedObserver = asDelta(recovered.get(observerB.playerId));
    expect(observerRecovery.baseline).toBe(true);
    expect(unaffectedObserver.baseline).toBe(false);
    const movingActor = observerRecovery.entities.find((entry) => entry.id === mover.playerId);
    if (!movingActor || "unchanged" in movingActor) {
      throw new Error("recovery baseline must contain the full moving actor");
    }
    const movementTicks = 3;
    const expectedZVelocity = JUMP_VELOCITY - GRAVITY * TICK_DT * movementTicks;
    const expectedZ = beforeJump + TICK_DT * (
      movementTicks * JUMP_VELOCITY -
      GRAVITY * TICK_DT * movementTicks * (movementTicks - 1) / 2
    );
    expect(movingActor).toMatchObject({
      vy: 0,
      air: true,
    });
    expect(movingActor.vx).toBeCloseTo(MOVE_SPEED);
    expect(movingActor.vz).toBeCloseTo(expectedZVelocity);
    expect(movingActor.z).toBeCloseTo(expectedZ);
    expect(playerEntity(sim, mover.playerId).body.zVel).toBeCloseTo(expectedZVelocity);
  });
});
