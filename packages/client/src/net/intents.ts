import type { Connection } from "./connection.js";

/**
 * Outgoing-intent bodies for Connection's public methods — split out so
 * connection.ts (the state facade) stays under the file-size cap. Every
 * function takes the Connection first and is a thin canAct-guard + send;
 * Connection's methods just delegate here, so no call site changes.
 */

function normalized(dirX: number, dirY: number): { dirX: number; dirY: number } {
  // The protocol carries a unit direction — aiming at a point several
  // tiles away must not fail validation and silently vanish.
  const len = Math.hypot(dirX, dirY) || 1;
  return { dirX: dirX / len, dirY: dirY / len };
}

export function attackIntent(conn: Connection, dirX: number, dirY: number): void {
  if (!conn.canAct) return;
  conn.send({ type: "attack", ...normalized(dirX, dirY) });
}

export function throwTorchIntent(conn: Connection, dirX: number, dirY: number): void {
  if (!conn.canAct) return;
  const { dirX: x, dirY: y } = normalized(dirX, dirY);
  conn.send({ type: "throwTorch", dirX: x, dirY: y });
}

export function useSlotIntent(conn: Connection, slot: number, targetX?: number, targetY?: number): void {
  if (!conn.canAct) return;
  conn.send({
    type: "useSlot",
    slot,
    ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}),
  });
}

export function assignSlotIntent(conn: Connection, slot: number, item: string | null): void {
  if (!conn.canAct) return;
  conn.send({ type: "assign", slot, item });
}

export function partyOpIntent(
  conn: Connection,
  op: "invite" | "accept" | "leave",
  target?: string,
): void {
  if (!conn.canAct) return;
  if (op === "accept") conn.pendingInvite = null;
  conn.send({ type: "party", op, ...(target !== undefined ? { target } : {}) });
}

export function chatIntent(
  conn: Connection,
  channel: "party" | "local" | "global" | "dm",
  text: string,
  target?: string,
): void {
  if (!conn.canAct) return;
  conn.send({ type: "chat", channel, text, ...(target !== undefined ? { target } : {}) });
}

/** Zero-arg/one-arg intents that are already a single guarded send — grouped
 * here purely to keep connection.ts's method bodies to one delegating line. */
export function pickupIntent(conn: Connection): void {
  if (conn.canAct) conn.send({ type: "pickup" });
}

export function dropIntent(conn: Connection, item: string): void {
  if (conn.canAct) conn.send({ type: "drop", item });
}

export function equipIntent(conn: Connection, item: string | null): void {
  if (conn.canAct) conn.send({ type: "equip", item });
}

export function interactIntent(conn: Connection): void {
  if (conn.canAct) conn.send({ type: "interact" });
}

export function craftIntent(conn: Connection, recipe: string): void {
  if (conn.canAct) conn.send({ type: "craft", recipe });
}

export function stashOpIntent(conn: Connection, op: "put" | "take", index: number): void {
  if (conn.canAct) conn.send({ type: "stash", op, index });
}

export function fistbumpIntent(conn: Connection, targetId: string): void {
  if (conn.canAct) conn.send({ type: "fistbump", targetId });
}

export function whoIntent(conn: Connection): void {
  if (conn.canAct) conn.send({ type: "who" });
}

export function suicideIntent(conn: Connection): void {
  if (conn.status === "connected" && conn.hp > 0) conn.send({ type: "suicide" });
}

export function debugTeleportIntent(conn: Connection, x: number, y: number): void {
  conn.send({ type: "debug", op: "teleport", x, y });
}

export function debugGodIntent(conn: Connection, on: boolean): void {
  conn.send({ type: "debug", op: "god", on });
}
