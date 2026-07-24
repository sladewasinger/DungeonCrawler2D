import { World, type AreaTileUpdate, type GameEvent, type ServerSnapshot } from "@dc2d/engine";
import { parseFistbumpSealPartner } from "../ui/chat/fistbumpSeal.js";
import { isBossDefId } from "./bossDefIds.js";
import type { Connection } from "./connection.js";
import { floorChangeEvents } from "./floorEvents.js";
import { recordSample } from "./interpolate.js";
import { xpGainEvents } from "./xpEvents.js";

/**
 * Applies server truth to the Connection's state: authoritative self
 * (with prediction reconciliation), remote entity samples, area tiles,
 * and the events that feed UI state.
 */

export function applySnapshot(conn: Connection, snap: ServerSnapshot): void {
  if (!conn.world) return;
  conn.serverTick = snap.tick;
  applySelfState(conn, snap, conn.world);
  conn.hasReceivedSnapshot = true;

  const now = performance.now();
  for (const entity of snap.entities) applyEntitySample(conn, now, entity);
  for (const tile of snap.areas) applyAreaTile(conn, tile);
  // Events (incl. a same-tick "death") are applied before `left` prunes conn.entities,
  // so a dying entity's last known position/defId is still there for the blood-VFX
  // lookup in scenes/dungeon/visualEvents.ts (its own GameEvent carries no position —
  // engine/net/server.ts's gameEventSchema — ASSUMPTIONS.md #55).
  for (const event of snap.events) applyEvent(conn, event);
  for (const id of snap.left) conn.entities.delete(id);
  conn.onSnapshot?.();
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
  const wasDead = conn.hp <= 0;
  conn.hp = snap.self.hp;
  conn.maxHp = snap.self.maxHp;
  conn.fx = snap.self.fx;
  if (wasDead && conn.hp > 0) conn.justRespawned = true;
  conn.downed = snap.self.downed ?? false;
  if (conn.hp <= 0 || conn.downed) conn.prediction.reset();
  else conn.prediction.reconcile(world, conn.body, snap.lastSeq);
  if (predictedBeforeSnapshot) conn.predictionCorrection.record(predictedBeforeSnapshot, conn.body);
  applyXpState(conn, snap.self.xp ?? conn.xp, snap.self.level ?? conn.charLevel, snap.self.xpForNext ?? conn.xpForNext);
  applyFloorState(conn, snap);
  conn.inventory = snap.inventory;
  conn.hotbar = snap.hotbar;
  conn.weapon = snap.weapon;
  conn.party = snap.party;
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
 * socket.ts's onWelcome, from the JOIN-time floor — every descend/ascend left it
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

/** Appends one chat line and, for the server's exact fistbump-seal phrasing (no
 * dedicated wire event exists — see sim/contacts.ts's sealMutualContact), also
 * queues the local success-flourish visual event. */
function applyChatEvent(conn: Connection, event: Extract<GameEvent, { t: "chat" }>): void {
  conn.chatLog.push({
    channel: event.channel,
    from: event.from,
    name: event.name,
    text: event.text,
    ...(event.target !== undefined ? { target: event.target } : {}),
  });
  conn.chatSeq++;
  // Deep enough to keep /r's DM-thread lookback working across a busy multi-tab session.
  if (conn.chatLog.length > 40) conn.chatLog.shift();
  const sealedWith = parseFistbumpSealPartner(event.channel, event.text);
  if (sealedWith) conn.visualEvents.push({ t: "fistbumpSealed", partnerName: sealedWith });
}

function applyEvent(conn: Connection, event: GameEvent): void {
  switch (event.t) {
    case "toast":
      // Routed through Connection.pushToast (net/connection.ts) so server and
      // client-local toasts (input toasts wiring, Epic 7.13) share one queue/duration.
      conn.pushToast(event.msg);
      return;
    case "chat":
      applyChatEvent(conn, event);
      return;
    case "invite":
      conn.pendingInvite = { from: event.from, name: event.name };
      return;
    case "stash":
      conn.stash = event.slots;
      return;
    case "contactsUpdated":
      conn.contacts = event.contacts;
      return;
    case "teleported":
      conn.teleported = true;
      conn.prediction.reset();
      conn.predictionCorrection.reset();
      conn.entities.clear();
      conn.areaTiles.clear();
      return;
    case "death":
      // Applied before `left` prunes conn.entities (see applySnapshot's ordering comment),
      // so the dying entity's defId/name is still there for the boss-down check below.
      conn.visualEvents.push(event);
      pushBossDownIfBoss(conn, event.id);
      return;
    default:
      // Remaining variants (hit/status) are visual-only; the scene drains them.
      conn.visualEvents.push(event);
      return;
  }
}

/** Epic 7.14 boss-death celebration: the wire has no dedicated "boss defeated" event,
 * so this recognizes it from a plain death whose entity carries a boss content id. */
function pushBossDownIfBoss(conn: Connection, id: string): void {
  const snap = conn.entities.get(id)?.snap;
  if (!isBossDefId(snap?.defId)) return;
  conn.visualEvents.push({ t: "bossDown", name: snap?.name ?? snap?.defId ?? "The boss" });
}
