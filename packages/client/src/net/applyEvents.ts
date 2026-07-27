import type { GameEvent } from "@dc2d/engine";
import { parseFistbumpSealPartner } from "../ui/chat/fistbumpSeal.js";
import { isBossDefId } from "./bossDefIds.js";
import type { Connection } from "./connection.js";
import { applyNpcSpeech } from "./npcSpeech.js";

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
  if (event.direction === "incoming") {
    conn.pendingInvite = event.action === "added"
      ? { from: event.id, name: event.name }
      : conn.pendingInvite?.from === event.id
        ? null
        : conn.pendingInvite;
    return;
  }
  if (event.action === "added") {
    conn.outgoingPartyInvites.set(event.id, event.name);
  } else {
    conn.outgoingPartyInvites.delete(event.id);
  }
};

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
  switch (event.t) {
    case "toast":
      conn.pushToast(event.msg);
      return true;
    case "npcSpeech":
      applyNpcSpeech(conn, event);
      return true;
    case "chat":
      applyChatEvent(conn, event);
      return true;
    case "invite":
      conn.pendingInvite = { from: event.from, name: event.name };
      return true;
    case "partyInviteState":
      applyPartyInviteState(conn, event);
      return true;
    case "contactsUpdated":
      conn.contacts = event.contacts.map((contact) => ({
        name: contact.name,
        online: contact.online,
        ...(contact.id === undefined ? {} : { id: contact.id }),
      }));
      return true;
    case "moderationUpdated":
      conn.mutedPlayers = new Set(event.muted);
      conn.blockedPlayers = new Set(event.blocked);
      return true;
    default:
      return false;
  }
};

const pushBossDownIfBoss = (conn: Connection, id: string): void => {
  const snap = conn.entities.get(id)?.snap;
  if (!isBossDefId(snap?.defId)) return;
  conn.visualEvents.push({
    t: "bossDown",
    name: snap?.name ?? snap?.defId ?? "The boss",
  });
};

function capturedCombatTarget(conn: Connection, id: string) {
  if (id === conn.welcome?.playerId && conn.body) {
    return {
      x: conn.body.x,
      y: conn.body.y,
      targetKind: "player" as const,
      skin: conn.skin,
    };
  }
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
  if (
    event.t === "hit" ||
    event.t === "health" ||
    event.t === "damageImpact" ||
    event.t === "status"
  ) {
    conn.visualEvents.push({
      ...event,
      ...capturedCombatTarget(conn, event.id),
    });
  }
  if (event.t === "death") {
    conn.deathVisualEvents.push({
      ...event,
      ...capturedCombatTarget(conn, event.id),
    });
    pushBossDownIfBoss(conn, event.id);
  }
};
