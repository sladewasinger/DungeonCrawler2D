import { type ServerSnapshotDelta } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { freshConnection, snapshotAtFloor } from "./applyTestSupport.js";
import { applySnapshotDelta } from "./snapshotDelta.js";

interface DeltaOptions {
  tick: number;
  baseTick: number | null;
  baseline: boolean;
  areas?: ServerSnapshotDelta["areas"];
}

function deltaAt(options: DeltaOptions): ServerSnapshotDelta {
  const full = snapshotAtFloor(1, 10);
  return {
    type: "snapshotDelta", ...options, areas: options.areas ?? [], lastSeq: full.lastSeq,
    lastProjectedServerTick: full.lastProjectedServerTick, self: full.self, inventoryRevision: 1,
    ...(options.baseline ? { inventory: [{ item: "bandage", qty: 2 }] } : {}), hotbarRevision: 1,
    ...(options.baseline ? { hotbar: ["bandage"] } : {}), weapon: full.weapon, party: full.party,
    entities: options.baseline ? [{ id: "item-1", kind: "item", defId: "rag", x: 1, y: 2, z: 0, revision: 3 }] : [{ id: "item-1", revision: 3, unchanged: true }],
    left: [], events: [],
  };
}

describe("applySnapshotDelta", () => {
  it("applies known revisions, rejects a missed tick, and recovers from a baseline", () => {
    const conn = freshConnection(1);
    const send = vi.spyOn(conn, "send").mockImplementation(() => undefined);
    applySnapshotDelta(conn, deltaAt({ tick: 10, baseTick: null, baseline: true, areas: [{ x: 0, y: 0, defId: "area-fire" }] }));
    expect(conn.inventory).toEqual([{ item: "bandage", qty: 2 }]);
    expect(conn.entities.get("item-1")?.snap.defId).toBe("rag");
    expect(conn.areaTiles.get("0,0")).toBe("area-fire");
    applySnapshotDelta(conn, deltaAt({ tick: 11, baseTick: 10, baseline: false }));
    expect(conn.serverTick).toBe(11);
    applySnapshotDelta(conn, deltaAt({ tick: 13, baseTick: 12, baseline: false, areas: [{ x: 0, y: 0, defId: null }, { x: 1, y: 0, defId: "area-wet" }] }));
    expect(conn.serverTick).toBe(11);
    expect(conn.snapshotRevisions.awaitingBaseline).toBe(true);
    expect(conn.networkMetrics.snapshot(performance.now()).recoveryRequests).toBe(1);
    applySnapshotDelta(conn, deltaAt({ tick: 14, baseTick: 13, baseline: false, areas: [{ x: 2, y: 0, defId: "area-oil" }] }));
    expect(send).toHaveBeenCalledWith({ type: "snapshotResync" });
    applySnapshotDelta(conn, deltaAt({ tick: 15, baseTick: null, baseline: true, areas: [{ x: 1, y: 0, defId: "area-wet" }] }));
    expect(conn.serverTick).toBe(15);
    expect(conn.snapshotRevisions.awaitingBaseline).toBe(false);
    expect([...conn.areaTiles]).toEqual([["1,0", "area-wet"]]);
  });
});
