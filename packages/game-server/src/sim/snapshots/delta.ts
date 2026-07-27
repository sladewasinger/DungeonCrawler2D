import type { ServerSnapshotDelta } from "@dc2d/engine";
import type { PlayerSlot } from "../state.js";
import type { PlayerSnapshotFrame } from "../playerSnapshot.js";
import {
  deltaEntityEntries,
  finishDeltaSnapshot,
  needsSnapshotBaseline,
  syncHotbarRevision,
  syncInventoryRevision,
} from "../snapshotReplication.js";
import type { SnapshotClientState } from "../snapshotState.js";

interface DeltaSnapshotRequest {
  slot: PlayerSlot;
  frame: PlayerSnapshotFrame;
  state: SnapshotClientState;
}

export function deltaSnapshot({ slot, frame, state }: DeltaSnapshotRequest): ServerSnapshotDelta {
  const baseline = needsSnapshotBaseline(state);
  const inventoryChanged = syncInventoryRevision(state, slot.inventory);
  const hotbarChanged = syncHotbarRevision(state, slot.hotbar);
  return finishDeltaSnapshot(state, deltaPayload({ slot, frame, state, baseline, inventoryChanged, hotbarChanged }));
}

function deltaPayload({ frame, state, baseline, inventoryChanged, hotbarChanged }: DeltaSnapshotRequest & {
  baseline: boolean;
  inventoryChanged: boolean;
  hotbarChanged: boolean;
}): Omit<ServerSnapshotDelta, "baseTick" | "baseline"> {
  return {
    type: "snapshotDelta",
    tick: frame.tick,
    lastSeq: frame.lastSeq,
    lastProjectedServerTick: frame.lastProjectedServerTick,
    self: frame.self,
    inventoryRevision: state.inventoryRevision,
    ...(baseline || inventoryChanged ? { inventory: state.inventory } : {}),
    hotbarRevision: state.hotbarRevision,
    ...(baseline || hotbarChanged ? { hotbar: state.hotbar } : {}),
    weapon: frame.weapon,
    party: frame.party,
    entities: deltaEntityEntries(state, frame.entities, baseline),
    left: frame.left,
    events: frame.events,
    areas: frame.areas,
    roomDoors: frame.roomDoors,
  };
}
