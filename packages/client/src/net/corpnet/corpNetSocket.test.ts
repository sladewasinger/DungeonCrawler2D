import type { ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { freshConnection, snapshotAtFloor } from "../sync/applyTestSupport.js";
import {
  flushCorpNetSnapshots,
  queueCorpNetSnapshot,
  stopCorpNetWatchdog,
} from "./corpNetSocket.js";

function invalidDelta(): ServerSnapshotDelta {
  const snapshot = snapshotAtFloor(1);
  return {
    type: "snapshotDelta",
    tick: 1,
    baseTick: 0,
    baseline: false,
    lastSeq: snapshot.lastSeq,
    lastProjectedServerTick: snapshot.lastProjectedServerTick,
    self: snapshot.self,
    inventoryRevision: 0,
    hotbarRevision: 0,
    weapon: snapshot.weapon,
    party: snapshot.party,
    entities: [],
    left: [],
    events: [],
    areas: [],
  };
}

interface ValidDeltaInput {
  readonly tick: number;
  readonly baseTick: number | null;
  readonly baseline: boolean;
  readonly events?: ServerSnapshotDelta["events"];
}

function validDelta(input: ValidDeltaInput): ServerSnapshotDelta {
  const snapshot = snapshotAtFloor(1);
  const { tick, baseTick, baseline } = input;
  return {
    type: "snapshotDelta",
    tick,
    baseTick,
    baseline,
    lastSeq: snapshot.lastSeq,
    lastProjectedServerTick: snapshot.lastProjectedServerTick,
    self: snapshot.self,
    inventoryRevision: 0,
    ...(baseline ? { inventory: [] } : {}),
    hotbarRevision: 0,
    ...(baseline ? { hotbar: [] } : {}),
    weapon: snapshot.weapon,
    party: snapshot.party,
    entities: [],
    left: [],
    events: input.events ?? [],
    areas: [],
  };
}

describe("CorpNet snapshot recovery", () => {
  it("applies event snapshots immediately after queued dynamic deltas", () => {
    const connection = freshConnection(1);
    connection.corpNet.setEnabled(true, 0);

    queueCorpNetSnapshot(connection, validDelta({
      tick: 1,
      baseTick: null,
      baseline: true,
    }), 100);
    queueCorpNetSnapshot(connection, validDelta({
      tick: 2,
      baseTick: 1,
      baseline: false,
    }), 110);
    queueCorpNetSnapshot(connection, validDelta({
      tick: 3,
      baseTick: 2,
      baseline: false,
      events: [{ t: "toast", msg: "Recovered" }],
    }), 120);
    stopCorpNetWatchdog(connection);

    expect(connection.serverTick).toBe(3);
    expect(connection.toasts).toEqual([{ msg: "Recovered", until: expect.any(Number) }]);
  });

  it("keeps retrying when packets arrive but none can be applied", () => {
    const connection = freshConnection(1);
    connection.corpNet.setEnabled(true, 0);
    const observed = vi.spyOn(connection.corpNet, "observeSnapshot");
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);

    queueCorpNetSnapshot(connection, invalidDelta(), 100);
    flushCorpNetSnapshots(connection);
    stopCorpNetWatchdog(connection);

    expect(connection.snapshotRevisions.awaitingBaseline).toBe(true);
    expect(send).toHaveBeenCalledWith({ type: "snapshotResync" });
    expect(observed).not.toHaveBeenCalled();
  });
});
