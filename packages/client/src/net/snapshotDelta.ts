import type {
  EntitySnapshot,
  EntitySnapshotDeltaEntry,
  EntitySnapshotReference,
  EntitySnapshotRevision,
  ServerSnapshot,
  ServerSnapshotDelta,
} from "@dc2d/engine";
import { applySnapshot } from "./apply.js";
import type { Connection } from "./connection.js";

/** Validates and materializes negotiated deltas without exposing partial state. */

function isReference(entry: EntitySnapshotDeltaEntry): entry is EntitySnapshotReference {
  return "unchanged" in entry;
}

function baselineMatches(snapshot: ServerSnapshotDelta): boolean {
  return snapshot.baseTick === null &&
    snapshot.inventory !== undefined &&
    snapshot.hotbar !== undefined &&
    snapshot.entities.every((entry) => !isReference(entry));
}

function collectionRevisionMatches(
  current: number,
  next: number,
  includesPayload: boolean,
): boolean {
  if (next === current) return !includesPayload;
  return next === current + 1 && includesPayload;
}

function incrementalMatches(conn: Connection, snapshot: ServerSnapshotDelta): boolean {
  const revisions = conn.snapshotRevisions;
  if (revisions.awaitingBaseline || snapshot.baseTick !== revisions.tick) return false;
  if (!collectionRevisionMatches(
    revisions.inventory,
    snapshot.inventoryRevision,
    snapshot.inventory !== undefined,
  )) return false;
  if (!collectionRevisionMatches(
    revisions.hotbar,
    snapshot.hotbarRevision,
    snapshot.hotbar !== undefined,
  )) return false;
  return snapshot.entities.every((entry) => referenceMatches(conn, entry));
}

function revisionsMatch(conn: Connection, snapshot: ServerSnapshotDelta): boolean {
  return snapshot.baseline ? baselineMatches(snapshot) : incrementalMatches(conn, snapshot);
}

function referenceMatches(conn: Connection, entry: EntitySnapshotDeltaEntry): boolean {
  if (!isReference(entry)) return true;
  return conn.snapshotRevisions.entities.get(entry.id) === entry.revision &&
    conn.entities.has(entry.id);
}

function stripRevision(entry: EntitySnapshotRevision): EntitySnapshot {
  const { revision, ...snapshot } = entry;
  void revision;
  return snapshot;
}

function materializeEntities(
  conn: Connection,
  entries: EntitySnapshotDeltaEntry[],
): EntitySnapshot[] | null {
  const entities: EntitySnapshot[] = [];
  for (const entry of entries) {
    if (!isReference(entry)) {
      entities.push(stripRevision(entry));
      continue;
    }
    const cached = conn.entities.get(entry.id)?.snap;
    if (!cached) return null;
    entities.push(cached);
  }
  return entities;
}

function materializeSnapshot(
  conn: Connection,
  delta: ServerSnapshotDelta,
): ServerSnapshot | null {
  const entities = materializeEntities(conn, delta.entities);
  if (!entities) return null;
  return {
    type: "snapshot",
    tick: delta.tick,
    lastSeq: delta.lastSeq,
    self: delta.self,
    inventory: delta.inventory ?? conn.inventory,
    hotbar: delta.hotbar ?? conn.hotbar,
    weapon: delta.weapon,
    party: delta.party,
    entities,
    left: delta.left,
    events: delta.events,
    areas: delta.areas,
  };
}

function requestBaseline(conn: Connection): void {
  conn.snapshotRevisions.awaitingBaseline = true;
  if (conn.snapshotRevisions.resyncPending) return;
  conn.snapshotRevisions.resyncPending = true;
  conn.send({ type: "snapshotResync" });
}

function commitRevisions(conn: Connection, snapshot: ServerSnapshotDelta): void {
  const revisions = conn.snapshotRevisions;
  revisions.tick = snapshot.tick;
  revisions.inventory = snapshot.inventoryRevision;
  revisions.hotbar = snapshot.hotbarRevision;
  revisions.entities.clear();
  for (const entry of snapshot.entities) revisions.entities.set(entry.id, entry.revision);
  revisions.awaitingBaseline = false;
  revisions.resyncPending = false;
}

/** Applies a complete baseline or one delta whose base/revisions are known locally. */
export function applySnapshotDelta(conn: Connection, snapshot: ServerSnapshotDelta): void {
  if (!conn.world || !revisionsMatch(conn, snapshot)) {
    requestBaseline(conn);
    return;
  }
  const materialized = materializeSnapshot(conn, snapshot);
  if (!materialized) {
    requestBaseline(conn);
    return;
  }
  if (snapshot.baseline) {
    conn.entities.clear();
    conn.areaTiles.clear();
    conn.snapshotRevisions.entities.clear();
  }
  applySnapshot(conn, materialized);
  commitRevisions(conn, snapshot);
}
