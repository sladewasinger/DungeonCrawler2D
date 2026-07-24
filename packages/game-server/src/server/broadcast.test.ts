import type { ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { makeSim } from "../sim/integration/support.js";
import type { PreparedSnapshotDelivery } from "../sim/snapshots.js";
import { deliverSnapshots } from "./broadcast.js";
import { ServerNetworkDiagnostics } from "./networkDiagnostics.js";
import type { SocketMap } from "./types.js";

interface FakeSocket {
  readyState: number;
  bufferedAmount: number;
  sent: string[];
  send(payload: string): void;
}

function socket(
  readyState: number,
  onSend?: (payload: string) => void,
): FakeSocket {
  const sent: string[] = [];
  return {
    readyState,
    bufferedAmount: 0,
    sent,
    send(payload) {
      onSend?.(payload);
      sent.push(payload);
    },
  };
}

function asDelta(delivery: PreparedSnapshotDelivery): ServerSnapshotDelta {
  if (delivery.snapshot.type !== "snapshotDelta") throw new Error("expected delta");
  return delivery.snapshot;
}

function nextPrepared(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
): PreparedSnapshotDelivery {
  for (let attempts = 0; attempts < 2; attempts++) {
    const delivery = sim.stepPreparedReplicated().get(playerId);
    if (delivery) return delivery;
  }
  throw new Error("snapshot cadence exceeded two ticks");
}

function socketsFor(
  playerId: string,
  sim: ReturnType<typeof makeSim>,
  fake: FakeSocket,
): SocketMap {
  return new Map([[playerId, {
    ws: fake as unknown as WebSocket,
    sim,
  }]]);
}

function nearbyWalkable(
  sim: ReturnType<typeof makeSim>,
  originX: number,
  originY: number,
): { x: number; y: number } {
  for (let distance = 1; distance <= 4; distance++) {
    const candidates = [
      { x: originX + distance, y: originY },
      { x: originX - distance, y: originY },
      { x: originX, y: originY + distance },
      { x: originX, y: originY - distance },
    ];
    const candidate = candidates.find(({ x, y }) => sim.world.isWalkable(x, y));
    if (candidate) return candidate;
  }
  throw new Error("missing nearby walkable area tile");
}

describe("transactional snapshot delivery", () => {
  it("retains every cursor and queued payload until an open socket accepts the frame", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Observer", "client-observer");
    const item = sim.spawnItem("rag", player.spawn.x + 1, player.spawn.y);
    const departed = sim.spawnItem("rag", player.spawn.x + 2, player.spawn.y);
    const areaX = Math.floor(player.spawn.x);
    const areaY = Math.floor(player.spawn.y);
    const dirtyArea = nearbyWalkable(sim, areaX, areaY);
    sim.configureSnapshotMode(player.playerId, "delta-v1");
    sim.injectGlobalChat({ t: "toast", msg: "queued-event" });
    sim.areas.spawn("area-wet", areaX, areaY, 0);
    sim.areas.drainDirty();
    sim.areas.spawn("area-wet", dirtyArea.x, dirtyArea.y, 0);
    const diagnostics = new ServerNetworkDiagnostics();

    const missing = nextPrepared(sim, player.playerId);
    const missingSnapshot = asDelta(missing);
    expect(missingSnapshot).toMatchObject({ baseline: true, baseTick: null });
    expect(missingSnapshot.events).toContainEqual({ t: "toast", msg: "queued-event" });
    expect(missingSnapshot.areas).toContainEqual({
      x: areaX,
      y: areaY,
      defId: "area-wet",
    });
    expect(missingSnapshot.areas).toContainEqual({
      x: dirtyArea.x,
      y: dirtyArea.y,
      defId: "area-wet",
    });
    deliverSnapshots(
      new Map([[player.playerId, missing]]),
      new Map(),
      diagnostics,
    );
    departed.body.x += 100;

    const unavailable = nextPrepared(sim, player.playerId);
    const unavailableSnapshot = asDelta(unavailable);
    expect(unavailableSnapshot).toMatchObject({
      baseline: true,
      baseTick: null,
      inventoryRevision: missingSnapshot.inventoryRevision,
      hotbarRevision: missingSnapshot.hotbarRevision,
      left: [],
    });
    expect(unavailableSnapshot.entities.some((entry) => entry.id === departed.id)).toBe(false);
    expect(unavailableSnapshot.events).toContainEqual({ t: "toast", msg: "queued-event" });
    expect(unavailableSnapshot.areas).toContainEqual({
      x: areaX,
      y: areaY,
      defId: "area-wet",
    });
    expect(unavailableSnapshot.areas).toContainEqual({
      x: dirtyArea.x,
      y: dirtyArea.y,
      defId: "area-wet",
    });
    deliverSnapshots(
      new Map([[player.playerId, unavailable]]),
      socketsFor(player.playerId, sim, socket(WebSocket.CLOSED)),
      diagnostics,
    );

    const throwing = nextPrepared(sim, player.playerId);
    const throwingSnapshot = asDelta(throwing);
    expect(throwingSnapshot).toMatchObject({ baseline: true, baseTick: null });
    expect(throwingSnapshot.events).toContainEqual({ t: "toast", msg: "queued-event" });
    expect(throwingSnapshot.areas).toContainEqual({
      x: areaX,
      y: areaY,
      defId: "area-wet",
    });
    expect(throwingSnapshot.areas).toContainEqual({
      x: dirtyArea.x,
      y: dirtyArea.y,
      defId: "area-wet",
    });
    const throwingSocket = socket(WebSocket.OPEN, () => {
      throw new Error("transport rejected frame");
    });
    deliverSnapshots(
      new Map([[player.playerId, throwing]]),
      socketsFor(player.playerId, sim, throwingSocket),
      diagnostics,
    );
    expect(diagnostics.snapshot(performance.now() + 1000).server.outboundMessagesPerSecond)
      .toBe(0);

    const accepted = nextPrepared(sim, player.playerId);
    const acceptedSnapshot = asDelta(accepted);
    expect(acceptedSnapshot).toMatchObject({
      baseline: true,
      baseTick: null,
      inventoryRevision: missingSnapshot.inventoryRevision,
      hotbarRevision: missingSnapshot.hotbarRevision,
      left: [],
    });
    expect(acceptedSnapshot.events).toContainEqual({ t: "toast", msg: "queued-event" });
    expect(acceptedSnapshot.areas).toContainEqual({
      x: areaX,
      y: areaY,
      defId: "area-wet",
    });
    expect(acceptedSnapshot.areas).toContainEqual({
      x: dirtyArea.x,
      y: dirtyArea.y,
      defId: "area-wet",
    });
    expect(acceptedSnapshot.entities.find((entry) => entry.id === item.id))
      .not.toHaveProperty("unchanged");
    const openSocket = socket(WebSocket.OPEN);
    deliverSnapshots(
      new Map([[player.playerId, accepted]]),
      socketsFor(player.playerId, sim, openSocket),
      diagnostics,
    );
    expect(openSocket.sent).toHaveLength(1);
    expect(diagnostics.snapshot(performance.now() + 1000).server.outboundMessagesPerSecond)
      .toBeCloseTo(1, 0);

    const next = asDelta(nextPrepared(sim, player.playerId));
    expect(next).toMatchObject({
      baseline: false,
      baseTick: acceptedSnapshot.tick,
      events: [],
      areas: [],
    });
    expect(next.entities.find((entry) => entry.id === item.id))
      .toMatchObject({ unchanged: true });
  });
});
