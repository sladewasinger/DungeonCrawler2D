import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { makeSim } from "../sim/integration/support.js";
import { deliverSnapshots } from "./broadcast.js";
import { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import { asDelta, nearbyWalkable, nextPrepared, socket, socketsFor } from "./testSupport/broadcast.js";

const QUEUED_EVENT = "queued-event";

describe("transactional snapshot delivery", () => {
  it("retains every cursor and queued payload until an open socket accepts the frame", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Observer", clientId: "client-observer" });
    const item = sim.spawnItem({ defId: "rag", x: player.spawn.x + 1, y: player.spawn.y });
    const departed = sim.spawnItem({ defId: "rag", x: player.spawn.x + 2, y: player.spawn.y });
    const areaX = Math.floor(player.spawn.x);
    const areaY = Math.floor(player.spawn.y);
    const dirtyArea = nearbyWalkable(sim, areaX, areaY);
    sim.configureSnapshotMode(player.playerId, "delta-v1");
    sim.injectGlobalChat({ t: "toast", msg: QUEUED_EVENT });
    sim.areas.spawn({ defId: "area-wet", x: areaX, y: areaY, radius: 0 });
    sim.areas.drainDirty();
    sim.areas.spawn({ defId: "area-wet", x: dirtyArea.x, y: dirtyArea.y, radius: 0 });
    const diagnostics = new ServerNetworkDiagnostics();

    const missing = nextPrepared(sim, player.playerId);
    const missingSnapshot = asDelta(missing);
    expect(missingSnapshot).toMatchObject({ baseline: true, baseTick: null });
    expect(missingSnapshot.events).toContainEqual({ t: "toast", msg: QUEUED_EVENT });
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
    deliverSnapshots({ snapshots: new Map([[player.playerId, missing]]), sockets: new Map(), diagnostics });
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
    expect(unavailableSnapshot.events).toContainEqual({ t: "toast", msg: QUEUED_EVENT });
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
    deliverSnapshots({
      snapshots: new Map([[player.playerId, unavailable]]),
      sockets: socketsFor(player.playerId, sim, socket(WebSocket.CLOSED)),
      diagnostics,
    });

    const throwing = nextPrepared(sim, player.playerId);
    const throwingSnapshot = asDelta(throwing);
    expect(throwingSnapshot).toMatchObject({ baseline: true, baseTick: null });
    expect(throwingSnapshot.events).toContainEqual({ t: "toast", msg: QUEUED_EVENT });
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
    deliverSnapshots({
      snapshots: new Map([[player.playerId, throwing]]),
      sockets: socketsFor(player.playerId, sim, throwingSocket),
      diagnostics,
    });
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
    expect(acceptedSnapshot.events).toContainEqual({ t: "toast", msg: QUEUED_EVENT });
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
    deliverSnapshots({
      snapshots: new Map([[player.playerId, accepted]]),
      sockets: socketsFor(player.playerId, sim, openSocket),
      diagnostics,
    });
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
