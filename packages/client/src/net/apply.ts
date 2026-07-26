import { World, type AreaTileUpdate, type ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "./connection.js";
import { applyEvent } from "./applyEvents.js";
import {
  captureCombatHealth,
  inferMissingDamageEvents,
} from "./combatEventInference.js";
import { floorChangeEvents } from "./floorEvents.js";
import { recordSample } from "./interpolate.js";
import { xpGainEvents } from "./xpEvents.js";
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

  const now = performance.now();
  const serverTime = conn.serverTimeline.observe(snap.tick, now);
  conn.interpolationDelay.observe(snap.tick, now);
  for (const entity of snap.entities) applyEntitySample(conn, serverTime, entity);
  for (const tile of snap.areas) applyAreaTile(conn, tile);
  pruneAreaTiles(conn.areaTiles, snap.self.x, snap.self.y);
  // Capture visual-event targets before `left` prunes conn.entities. Rendering drains
  // these events later, so queue order alone cannot preserve a dead actor's position.
  for (const event of snap.events) applyEvent(conn, event);
  inferMissingDamageEvents(conn, snap, combatBefore);
  for (const id of snap.left) conn.entities.delete(id);
  conn.onSnapshot?.();
}

function applyRoomDoors(conn: Connection, snap: ServerSnapshot): void {
  conn.world?.replaceTileOverrides(snap.roomDoors ?? []);
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
  if (predictedBeforeSnapshot) conn.predictionCorrection.record(predictedBeforeSnapshot, conn.body);
  conn.networkMetrics.recordCorrection(conn.predictionCorrection.lastError);
  if (import.meta.env.DEV) {
    conn.movementTrace?.recordSnapshot(
      snap,
      predictedBeforeSnapshot,
      conn.body,
      conn.movementTraceState(),
    );
  }
  applyXpState(conn, snap.self.xp ?? conn.xp, snap.self.level ?? conn.charLevel, snap.self.xpForNext ?? conn.xpForNext);
  applyFloorState(conn, snap);
  conn.inventory = snap.inventory;
  conn.hotbar = snap.hotbar;
  conn.weapon = snap.weapon;
  conn.party = snap.party;
}

function applyVitals(conn: Connection, snap: ServerSnapshot): void {
  const wasDead = conn.hp <= 0;
  conn.hp = snap.self.hp;
  conn.maxHp = snap.self.maxHp;
  conn.stamina = snap.self.stamina ?? conn.stamina;
  conn.maxStamina = snap.self.maxStamina ?? conn.maxStamina;
  conn.blocking = snap.self.blocking ?? false;
  conn.staminaRecoveryDelaySeconds =
    snap.self.staminaRecoveryDelaySeconds ?? conn.staminaRecoveryDelaySeconds;
  conn.staminaExhausted =
    snap.self.staminaExhausted ?? conn.staminaExhausted;
  conn.healthRegenerationDelaySeconds =
    snap.self.healthRegenerationDelaySeconds ??
    conn.healthRegenerationDelaySeconds;
  conn.fx = snap.self.fx;
  conn.statusEffects = snapshotStatusEffects(snap);
  if (wasDead && conn.hp > 0) conn.justRespawned = true;
  conn.downed = snap.self.downed ?? false;
}

function reconcilePrediction(conn: Connection, snap: ServerSnapshot, world: World): void {
  if (conn.hp <= 0 || conn.downed) {
    conn.prediction.reset();
    return;
  }
  const body = conn.body;
  if (body) {
    conn.prediction.reconcile(
      world,
      body,
      snap.lastProjectedServerTick,
      snap.tick,
      conn,
      snap.weapon !== null,
    );
  }
}

function snapshotStatusEffects(snap: ServerSnapshot) {
  return snap.self.statusEffects ?? snap.self.fx.map((id) => ({
    id,
    remainingSeconds: null,
    durationSeconds: null,
  }));
}

/** Diffs the new xp/level against Connection's current values (pre-overwrite) and
 * queues xpGained/levelUp visual events before committing the new totals. Skipped on
 * the very first snapshot (conn.hasReceivedSnapshot still false) — a returning
 * player's whole banked xp/level must not read as a fresh gain on join. */
function applyXpState(conn: Connection, xp: number, level: number, xpForNext: number): void {
  if (conn.hasReceivedSnapshot) {
    conn.visualEvents.push(...xpGainEvents({ xp: conn.xp, level: conn.charLevel }, { xp, level }));
  }
  conn.xp = xp;
  conn.charLevel = level;
  conn.xpForNext = xpForNext;
}

/** Epic 7.14 (The Descent) — diffs the connected floor and queues a floorEntered visual
 * event on change. self.floor is additive/optional (protocol 15+, mirrors xp/level's
 * own rollout in ASSUMPTION #90), so this falls back to the welcome handshake's floor
 * for an older/mid-rollout server.
 *
 * INTEGRATION FIX (wave 8 gate): `conn.world` was only ever constructed once, in
 * socket.ts's onWelcome, from the join-time floor, so every transfer left it
 * silently stale (wrong chunk geometry for prediction, terrain, and this file's own
 * stairwayProximity checks), even though scenes/dungeon/index.ts's
 * `ensureWorldBoundSystems` was already written to rebuild on a `conn.world` identity
 * change and just never got one. Rebuilding here — the one place a floor change is
 * already detected — keeps `conn.world` (same worldSeed/level, new floor) in sync on
 * every transfer without new state elsewhere. */
function applyFloorState(conn: Connection, snap: ServerSnapshot): void {
  const next = snap.self.floor ?? conn.welcome?.floor ?? conn.floor;
  if (conn.hasReceivedSnapshot) conn.visualEvents.push(...floorChangeEvents(conn.floor, next));
  if (next !== conn.floor && conn.world) conn.world = new World(conn.world.worldSeed, next, conn.world.level);
  conn.floor = next;
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
