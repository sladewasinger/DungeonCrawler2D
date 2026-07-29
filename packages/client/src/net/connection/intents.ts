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

interface UseSlotIntentInput {
  readonly conn: Connection;
  readonly slot: number;
  readonly targetX?: number | undefined;
  readonly targetY?: number | undefined;
}

export function useSlotIntent({ conn, slot, targetX, targetY }: UseSlotIntentInput): void {
  if (!conn.canAct) return;
  conn.send({
    type: "useSlot",
    slot,
    ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}),
  });
}

export function useSlotOnPlayerIntent(conn: Connection, slot: number, targetId: string): void {
  if (conn.canAct) conn.send({ type: "useSlot", slot, targetId });
}

export function useItemIntent(conn: Connection, item: string): void {
  if (conn.canAct) conn.send({ type: "useItem", item });
}

export function assignSlotIntent(conn: Connection, slot: number, item: string | null): void {
  if (!conn.canAct) return;
  conn.send({ type: "assign", slot, item });
}

export function partyOpIntent(
  conn: Connection,
  op: "invite" | "accept" | "decline" | "cancel" | "leave" | "kick",
  target?: string,
): void {
  if (!conn.canAct) return;
  if (op === "accept" || op === "decline") conn.pendingInvite = null;
  conn.send({ type: "party", op, ...(target !== undefined ? { target } : {}) });
}

interface ModerationIntentInput {
  readonly conn: Connection;
  readonly op: "mute" | "unmute" | "block" | "unblock" | "report";
  readonly target: string;
  readonly reason?: string | undefined;
}

export function moderationIntent({ conn, op, target, reason }: ModerationIntentInput): void {
  if (!conn.canAct) return;
  conn.send({ type: "moderation", op, target, ...(reason ? { reason } : {}) });
}

interface ChatIntentInput {
  readonly conn: Connection;
  readonly channel: "party" | "local" | "global" | "dm";
  readonly text: string;
  readonly target?: string | undefined;
}

export function chatIntent({ conn, channel, text, target }: ChatIntentInput): void {
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

export function reviveIntent(conn: Connection, targetId: string, held: boolean): void {
  if (conn.status === "connected") conn.send({ type: "revive", targetId, held });
}

/** Descends a nearby one-way stairway; the server validates range. */
export function descendIntent(conn: Connection): void {
  if (conn.canAct) conn.send({ type: "descend" });
}

export function craftIntent(conn: Connection, recipe: string): void {
  if (conn.canAct) conn.send({ type: "craft", recipe });
}

export function stashOpIntent(conn: Connection, op: "put" | "take", index: number): void {
  if (conn.canAct) conn.send({ type: "stash", op, index });
}

interface LootChestIntentInput {
  readonly conn: Connection;
  readonly chestId: string;
  readonly op: "open" | "take" | "takeAll" | "close";
  readonly item?: string | undefined;
}

export function lootChestIntent({ conn, chestId, op, item }: LootChestIntentInput): void {
  if (!conn.canAct) return;
  conn.send({
    type: "lootChest",
    chestId,
    op,
    ...(item === undefined ? {} : { item }),
  });
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

/** Requests an authoritative safe-platform rescue, including while incapacitated. */
export function rescueIntent(conn: Connection): void {
  if (conn.status === "connected") conn.send({ type: "rescue" });
}

export function debugTeleportIntent(conn: Connection, x: number, y: number): void {
  conn.send({ type: "debug", op: "teleport", x, y });
}

export function debugGodIntent(conn: Connection, on?: boolean): void {
  conn.send({
    type: "debug",
    op: "god",
    ...(on === undefined ? {} : { on }),
  });
}
