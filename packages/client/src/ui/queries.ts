import { PICKUP_RANGE, TILE, type EntitySnapshot } from "@dc2d/engine";
import type { Connection } from "../net/connection";

/**
 * Proximity queries over replicated state — what's under and around
 * the player. All callers run after the scene's world/body guard, so
 * conn.world and conn.body are non-null here.
 */

export function tileUnderfoot(conn: Connection): number {
  const body = conn.body!;
  return conn.world!.tileAt(Math.floor(body.x), Math.floor(body.y));
}

export function nearTile(conn: Connection, tile: number): boolean {
  const body = conn.body!;
  const tx = Math.floor(body.x);
  const ty = Math.floor(body.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (conn.world!.tileAt(tx + dx, ty + dy) === tile) return true;
    }
  }
  return false;
}

export function tableNearby(conn: Connection): boolean {
  return nearTile(conn, TILE.CraftingTable);
}

export function stashNearby(conn: Connection): boolean {
  return nearTile(conn, TILE.Stash);
}

export function itemNearby(conn: Connection): boolean {
  const body = conn.body!;
  for (const { snap } of conn.entities.values()) {
    if (snap.kind !== "item") continue;
    if (Math.hypot(snap.x - body.x, snap.y - body.y) <= PICKUP_RANGE) return true;
  }
  return false;
}

export function downedAllyNearby(conn: Connection): boolean {
  const body = conn.body!;
  for (const { snap } of conn.entities.values()) {
    if (snap.kind === "player" && snap.downed) {
      if (Math.hypot(snap.x - body.x, snap.y - body.y) <= 1.6) return true;
    }
  }
  return false;
}

export function nearestPlayer(conn: Connection, range: number): EntitySnapshot | null {
  const body = conn.body!;
  let best: EntitySnapshot | null = null;
  let bestDist = range;
  for (const { snap } of conn.entities.values()) {
    if (snap.kind !== "player") continue;
    const d = Math.hypot(snap.x - body.x, snap.y - body.y);
    if (d < bestDist) {
      bestDist = d;
      best = snap;
    }
  }
  return best;
}
