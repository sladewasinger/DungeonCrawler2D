import type { GameEvent } from "@dc2d/engine";
import { parseFistbumpSealPartner } from "../../ui/chat/fistbumpSeal.js";
import { isBossDefId } from "../events/bossDefIds.js";
import type { Connection } from "../connection/connection.js";
import { applyNpcSpeech } from "../events/npcSpeech.js";
import { applyContactsEvent, applyModerationEvent } from "./applyContactEvents.js";

const applyChatEvent = (
  conn: Connection,
  event: Extract<GameEvent, { t: "chat" }>,
): void => {
  conn.chatLog.push({
    channel: event.channel,
    from: event.from,
    name: event.name,
    text: event.text,
    ...(event.target !== undefined ? { target: event.target } : {}),
  });
  conn.chatSeq++;
  if (conn.chatLog.length > 40) conn.chatLog.shift();
  const sealedWith = parseFistbumpSealPartner(event.channel, event.text);
  if (sealedWith) {
    conn.visualEvents.push({ t: "fistbumpSealed", partnerName: sealedWith });
  }
};

const applyPartyInviteState = (
  conn: Connection,
  event: Extract<GameEvent, { t: "partyInviteState" }>,
): void => {
  if (event.direction === "incoming") return applyIncomingInviteState(conn, event);
  applyOutgoingInviteState(conn, event);
};

function applyIncomingInviteState(conn: Connection, event: Extract<GameEvent, { t: "partyInviteState" }>): void {
  if (event.action === "added") conn.pendingInvite = { from: event.id, name: event.name };
  else if (conn.pendingInvite?.from === event.id) conn.pendingInvite = null;
}

function applyOutgoingInviteState(conn: Connection, event: Extract<GameEvent, { t: "partyInviteState" }>): void {
  if (event.action === "added") conn.outgoingPartyInvites.set(event.id, event.name);
  else conn.outgoingPartyInvites.delete(event.id);
}

const applyStorageEvent = (conn: Connection, event: GameEvent): boolean => {
  if (event.t === "stash") {
    conn.stash = event.slots;
    conn.stashContext = { kind: "personal", chestId: null };
    return true;
  }
  if (event.t !== "lootChest") return false;
  conn.stash = event.slots;
  conn.stashContext = { kind: "loot", chestId: event.chestId };
  return true;
};

const applyPrivateStateEvent = (
  conn: Connection,
  event: GameEvent,
): boolean => {
  if (applyStorageEvent(conn, event)) return true;
  return PRIVATE_EVENT_HANDLERS.some((handler) => handler(conn, event));
};

type PrivateEventHandler = (conn: Connection, event: GameEvent) => boolean;

const PRIVATE_EVENT_HANDLERS: readonly PrivateEventHandler[] = [
  applyToastEvent,
  applyNpcSpeechEvent,
  applyChatLogEvent,
  applyInviteEvent,
  applyPartyInviteEvent,
  applyContactsEvent,
  applyModerationEvent,
];

function applyToastEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "toast") return false;
  conn.pushToast(event.msg);
  return true;
}

function applyNpcSpeechEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "npcSpeech") return false;
  applyNpcSpeech(conn, event);
  return true;
}

function applyChatLogEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "chat") return false;
  applyChatEvent(conn, event);
  return true;
}

function applyInviteEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "invite") return false;
  conn.pendingInvite = { from: event.from, name: event.name };
  return true;
}

function applyPartyInviteEvent(conn: Connection, event: GameEvent): boolean {
  if (event.t !== "partyInviteState") return false;
  applyPartyInviteState(conn, event);
  return true;
}

const pushBossDownIfBoss = (conn: Connection, id: string): void => {
  const snap = conn.entities.get(id)?.snap;
  if (!isBossDefId(snap?.defId)) return;
  conn.visualEvents.push({
    t: "bossDown",
    name: snap?.name ?? snap?.defId ?? "The boss",
  });
};

function capturedCombatTarget(conn: Connection, id: string) {
  return selfCombatTarget(conn, id) ?? remoteCombatTarget(conn, id) ?? {};
}

function selfCombatTarget(conn: Connection, id: string) {
  if (id !== conn.welcome?.playerId || !conn.body) return undefined;
  return { x: conn.body.x, y: conn.body.y, targetKind: "player" as const, skin: conn.skin };
}

function remoteCombatTarget(conn: Connection, id: string) {
  const snap = conn.entities.get(id)?.snap;
  if (!snap || (snap.kind !== "player" && snap.kind !== "enemy")) return {};
  return {
    x: snap.x,
    y: snap.y,
    ...(snap.defId === undefined ? {} : { defId: snap.defId }),
    ...(snap.skin === undefined ? {} : { skin: snap.skin }),
    targetKind: snap.kind,
  };
}

export const applyEvent = (conn: Connection, event: GameEvent): void => {
  if (applyPrivateStateEvent(conn, event)) return;
  if (event.t === "teleported") {
    conn.teleported = true;
    return;
  }
  if (isCombatEvent(event)) applyCombatVisualEvent(conn, event);
  if (event.t === "death") applyDeathVisualEvent(conn, event);
};

type CombatVisualEvent = Extract<GameEvent, { t: "hit" }>
  | Extract<GameEvent, { t: "health" }>
  | Extract<GameEvent, { t: "damageImpact" }>
  | Extract<GameEvent, { t: "status" }>;

function isCombatEvent(event: GameEvent): event is CombatVisualEvent {
  return ["hit", "health", "damageImpact", "status"].includes(event.t);
}

function applyCombatVisualEvent(conn: Connection, event: CombatVisualEvent): void {
  conn.visualEvents.push({ ...event, ...capturedCombatTarget(conn, event.id) });
}

function applyDeathVisualEvent(conn: Connection, event: Extract<GameEvent, { t: "death" }>): void {
  conn.deathVisualEvents.push({ ...event, ...capturedCombatTarget(conn, event.id) });
  pushBossDownIfBoss(conn, event.id);
}
