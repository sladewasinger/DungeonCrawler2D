import type { ServerSnapshotDelta } from "@dc2d/engine";
import { snapshotAtFloor } from "../sync/applyTestSupport.js";

export interface ValidDeltaInput {
  readonly tick: number;
  readonly baseTick: number | null;
  readonly baseline: boolean;
  readonly events?: ServerSnapshotDelta["events"];
}

export function invalidDelta(): ServerSnapshotDelta {
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

export function validDelta(input: ValidDeltaInput): ServerSnapshotDelta {
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
