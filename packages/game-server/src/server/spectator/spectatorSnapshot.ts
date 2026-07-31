import type {
  GameEvent,
  ServerSnapshot,
  ServerSnapshotDelta,
  ServerStateSnapshot,
  InvStack,
} from "@dc2d/engine";

export interface SpectatorLoadoutSnapshot {
  readonly inventory: InvStack[];
  readonly hotbar: Array<string | null>;
}

const PUBLIC_EVENT_TYPES = new Set<GameEvent["t"]>([
  "blockFeedback",
  "damageImpact",
  "death",
  "health",
  "hit",
  "npcSpeech",
  "status",
  "teleported",
]);

export function publicSpectatorSnapshot(
  snapshot: ServerStateSnapshot,
  loadout: SpectatorLoadoutSnapshot,
): ServerStateSnapshot {
  return snapshot.type === "snapshot"
    ? publicFullSnapshot(snapshot, loadout)
    : publicDeltaSnapshot(snapshot, loadout);
}

function publicFullSnapshot(
  snapshot: ServerSnapshot,
  loadout: SpectatorLoadoutSnapshot,
): ServerSnapshot {
  return {
    ...snapshot,
    self: publicSelf(snapshot.self, loadout),
    inventory: loadout.inventory,
    hotbar: loadout.hotbar,
    events: publicEvents(snapshot.events),
  };
}

function publicDeltaSnapshot(
  snapshot: ServerSnapshotDelta,
  loadout: SpectatorLoadoutSnapshot,
): ServerSnapshotDelta {
  return {
    ...snapshot,
    self: publicSelf(snapshot.self, loadout),
    ...(snapshot.inventory === undefined ? {} : { inventory: loadout.inventory }),
    ...(snapshot.hotbar === undefined ? {} : { hotbar: loadout.hotbar }),
    events: publicEvents(snapshot.events),
  };
}

function publicSelf(
  self: ServerSnapshot["self"],
  loadout: SpectatorLoadoutSnapshot,
): ServerSnapshot["self"] {
  const { adminDebug, adminDebugEntities, ...publicState } = self;
  void adminDebug;
  void adminDebugEntities;
  return { ...publicState, spectatorLoadout: loadout };
}

function publicEvents(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => PUBLIC_EVENT_TYPES.has(event.t));
}
