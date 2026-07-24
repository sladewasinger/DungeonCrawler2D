import type {
  AreaTileUpdate,
  EntitySnapshot,
  GameEvent,
  InvStack,
  SnapshotMode,
} from "@dc2d/engine";

/** Persistent server-side replication caches; none of this is gameplay state. */

export interface SnapshotClientState {
  mode: SnapshotMode;
  forceBaseline: boolean;
  lastTick: number | null;
  inventoryRevision: number;
  inventory: InvStack[];
  hotbarRevision: number;
  hotbar: Array<string | null>;
  entityRevisions: Map<string, number>;
}

export interface SnapshotEntityState {
  revision: number;
  snapshot: EntitySnapshot;
}

export interface SnapshotPendingState {
  events: GameEvent[];
  areas: Map<string, AreaTileUpdate>;
}

export function newSnapshotClientState(mode: SnapshotMode): SnapshotClientState {
  return {
    mode,
    forceBaseline: true,
    lastTick: null,
    inventoryRevision: 0,
    inventory: [],
    hotbarRevision: 0,
    hotbar: [],
    entityRevisions: new Map(),
  };
}

export function cloneSnapshotClientState(state: SnapshotClientState): SnapshotClientState {
  return {
    ...state,
    inventory: state.inventory.map((stack) => ({ ...stack })),
    hotbar: [...state.hotbar],
    entityRevisions: new Map(state.entityRevisions),
  };
}

export function newSnapshotPendingState(): SnapshotPendingState {
  return { events: [], areas: new Map() };
}
