import { World, type AreaTileUpdate, type ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { applyEvent } from "./applyEvents.js";
import {
  captureCombatHealth,
  inferMissingDamageEvents,
} from "../events/combatEventInference.js";
import { applySnapshotProgression } from "./applyProgression.js";
import { applyVitals } from "./applyVitals.js";
import { recordSample } from "../interpolation/interpolate.js";
import { pruneAreaTiles } from "./areaTileRetention.js";

/**
 * Applies server truth to the Connection's state: authoritative self
 * (with prediction reconciliation), remote entity samples, area tiles,
 * and the events that feed UI state.
 */

export function applySnapshot(conn: Connection, snap: ServerSnapshot): void {
  if (!conn.world) return;
  const combatBefore = captureCombatHealth(conn);
  if (snap.events.some((event) => event.t === "teleported")) prepareTeleport(conn);
  conn.serverTick = snap.tick;
  applySelfState(conn, snap, conn.world);
  applyRoomDoors(conn, snap);
  conn.hasReceivedSnapshot = true;
  applyRemoteState(conn, snap);
  applySnapshotEvents(conn, snap, combatBefore);
  conn.onSnapshot?.();
}

function applyRemoteState(conn: Connection, snap: ServerSnapshot): void {
  const now = performance.now();
  const serverTime = conn.serverTimeline.observe(snap.tick, now);
  conn.interpolationDelay.observe(snap.tick, now);
  for (const entity of snap.entities) applyEntitySample(conn, serverTime, entity);
  for (const tile of snap.areas) applyAreaTile(conn, tile);
  pruneAreaTiles({ areaTiles: conn.areaTiles, centerX: snap.self.x, centerY: snap.self.y });
}

function applySnapshotEvents(
  conn: Connection,
  snap: ServerSnapshot,
  combatBefore: ReturnType<typeof captureCombatHealth>,
): void {
  // Capture visual-event targets before `left` prunes conn.entities. Rendering drains
  // these events later, so queue order alone cannot preserve a dead actor's position.
  for (const event of snap.events) applyEvent(conn, event);
  inferMissingDamageEvents(conn, snap, combatBefore);
  for (const id of snap.left) conn.entities.delete(id);
}

function applyRoomDoors(conn: Connection, snap: ServerSnapshot): void {
  conn.world?.replaceFeatureOverrides(snap.roomDoors ?? []);
  conn.roomDoors = snap.roomDoors ?? [];
}

function prepareTeleport(conn: Connection): void {
  conn.entities.clear();
  conn.snapshotRevisions.entities.clear();
  conn.areaTiles.clear();
  conn.prediction.reset();
  conn.predictionCorrection.reset(true);
}

function applySelfState(conn: Connection, snap: ServerSnapshot, world: World): void {
  const predictedBeforeSnapshot = conn.body;
  // Self: adopt authoritative state, replay unacked inputs.
  conn.body = {
    x: snap.self.x,
    y: snap.self.y,
    z: snap.self.z,
    zVel: snap.self.zVel,
    grounded: snap.self.grounded,
    coyoteTime: snap.self.coyoteTime,
    jumpBuffer: snap.self.jumpBuffer,
    jumpHeld: snap.self.jumpHeld,
    fallStart: snap.self.z,
    kx: snap.self.kx,
    ky: snap.self.ky,
  };
  // Panel round 4 (LANE B): hp <=0 -> >0 is a real respawn handoff (game-server's
  // respawnSlot, which also grants a fresh spawn-grace window) — the party-revive
  // "downed" flag below never actually zeroes hp (downPlayer clamps it to 1, not 0), so
  // hp is the one wire-visible signal that covers the common solo-death path too,
  // without a protocol change. Connection's `hp` field defaults to 0, so this also
  // fires on the very first snapshot of a brand-new connection (a genuine fresh join,
  // also grace-eligible server-side) — the one accepted false positive is a full page
  // reload reconnecting into a still-alive body, which cosmetically shows a ring the
  // server didn't actually grant for ~2s; harmless (no gameplay effect either way). See
  // docs/ASSUMPTIONS.md row 380.
  applyVitals(conn, snap);
  reconcilePrediction(conn, snap, world);
  recordPredictionCorrection(conn, predictedBeforeSnapshot);
  conn.networkMetrics.recordCorrection(conn.predictionCorrection.lastError);
  recordDevelopmentTrace(conn, snap, predictedBeforeSnapshot);
  applySnapshotProgression(conn, snap);
  applyInventoryState(conn, snap);
}

function recordPredictionCorrection(conn: Connection, before: Connection["body"]): void {
  if (before && conn.body) conn.predictionCorrection.record(before, conn.body);
}

function recordDevelopmentTrace(conn: Connection, snap: ServerSnapshot, before: Connection["body"]): void {
  if (import.meta.env.DEV) {
    conn.movementTrace?.recordSnapshot({
      snapshot: snap,
      predictedBefore: before,
      predictedAfter: conn.body,
      client: conn.movementTraceState(),
    });
  }
}

function applyInventoryState(conn: Connection, snap: ServerSnapshot): void {
  conn.inventory = snap.inventory;
  conn.hotbar = snap.hotbar;
  conn.weapon = snap.weapon;
  conn.party = snap.party;
}


function reconcilePrediction(conn: Connection, snap: ServerSnapshot, world: World): void {
  if (conn.hp <= 0 || conn.downed) {
    conn.prediction.reset();
    return;
  }
  const body = conn.body;
  if (body) {
    conn.prediction.reconcile({
      world,
      body,
      lastSimulatedProjectedTick: snap.lastProjectedServerTick,
      authoritativeServerTick: snap.tick,
      resources: conn,
      canBlock: snap.weapon !== null,
    });
  }
}


function applyEntitySample(
  conn: Connection,
  now: number,
  entity: ServerSnapshot["entities"][number],
): void {
  let remote = conn.entities.get(entity.id);
  if (!remote) {
    remote = { snap: entity, samples: [] };
    conn.entities.set(entity.id, remote);
  }
  recordSample(remote, now, entity);
}

function applyAreaTile(conn: Connection, tile: AreaTileUpdate): void {
  const key = `${tile.x},${tile.y}`;
  if (tile.defId === null) conn.areaTiles.delete(key);
  else conn.areaTiles.set(key, tile.defId);
}
