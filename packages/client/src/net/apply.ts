import type { AreaTileUpdate, GameEvent, ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "./connection";
import { recordSample } from "./interpolate";

/**
 * Applies server truth to the Connection's state: authoritative self
 * (with prediction reconciliation), remote entity samples, area tiles,
 * and the events that feed UI state.
 */

export function applySnapshot(conn: Connection, snap: ServerSnapshot): void {
  if (!conn.world) return;

  // Self: adopt authoritative state, replay unacked inputs.
  conn.body = {
    x: snap.self.x,
    y: snap.self.y,
    z: snap.self.z,
    zVel: snap.self.zVel,
    grounded: snap.self.grounded,
    coyoteTime: snap.self.coyoteTime,
    fallStart: snap.self.z,
    kx: snap.self.kx,
    ky: snap.self.ky,
  };
  conn.prediction.reconcile(conn.world, conn.body, snap.lastSeq);

  conn.hp = snap.self.hp;
  conn.maxHp = snap.self.maxHp;
  conn.fx = snap.self.fx;
  conn.downed = snap.self.downed ?? false;
  conn.inventory = snap.inventory;
  conn.hotbar = snap.hotbar;
  conn.weapon = snap.weapon;
  conn.party = snap.party;

  const now = performance.now();
  for (const entity of snap.entities) {
    let remote = conn.entities.get(entity.id);
    if (!remote) {
      remote = { snap: entity, samples: [] };
      conn.entities.set(entity.id, remote);
    }
    recordSample(remote, now, entity);
  }
  for (const id of snap.left) conn.entities.delete(id);

  for (const tile of snap.areas) applyAreaTile(conn, tile);

  for (const event of snap.events) applyEvent(conn, event);
}

function applyAreaTile(conn: Connection, tile: AreaTileUpdate): void {
  const key = `${tile.x},${tile.y}`;
  if (tile.defId === null) conn.areaTiles.delete(key);
  else conn.areaTiles.set(key, tile.defId);
}

function applyEvent(conn: Connection, event: GameEvent): void {
  switch (event.t) {
    case "toast":
      conn.toasts.push({ msg: event.msg, until: performance.now() + 5000 });
      if (conn.toasts.length > 5) conn.toasts.shift();
      return;
    case "chat":
      conn.chatLog.push({ channel: event.channel, name: event.name, text: event.text });
      if (conn.chatLog.length > 8) conn.chatLog.shift();
      return;
    case "invite":
      conn.pendingInvite = { from: event.from, name: event.name };
      return;
    case "stash":
      conn.stash = event.slots;
      return;
    case "teleported":
      conn.teleported = true;
      conn.prediction.reset();
      conn.entities.clear();
      conn.areaTiles.clear();
      return;
    case "hit":
    case "death":
    case "status":
      conn.visualEvents.push(event);
      return;
  }
}
