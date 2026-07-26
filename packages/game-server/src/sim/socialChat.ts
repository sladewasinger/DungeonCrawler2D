import type { GameEvent } from "@dc2d/engine";
import {
  CHAT_LIMIT,
  RATE_WINDOW_TICKS,
  findOnlineByName,
  withinRateLimit,
} from "./contacts.js";
import { socialDeliveryAllowed, socialPairAllowed } from "./moderation.js";
import type { PlayerSlot, SimState } from "./state.js";

const systemLine = (text: string): GameEvent => ({
  t: "chat",
  channel: "system",
  from: "server",
  name: "system",
  text,
});

export function doChat(
  sim: SimState,
  slot: PlayerSlot,
  channel: "party" | "local" | "global" | "dm",
  text: string,
  target?: string,
): void {
  if (!withinRateLimit(
    slot.chatTimestamps,
    sim.tickCount,
    RATE_WINDOW_TICKS,
    CHAT_LIMIT,
  )) {
    slot.outbox.push(systemLine("You're sending messages too fast — slow down."));
    return;
  }
  if (channel === "party") doPartyChat(sim, slot, text);
  else if (channel === "local") doLocalChat(sim, slot, text);
  else if (channel === "global") doGlobalChat(sim, slot, text);
  else doDmChat(sim, slot, text, target);
}

function doPartyChat(sim: SimState, slot: PlayerSlot, text: string): void {
  if (!slot.partyId) return;
  const party = sim.parties.get(slot.partyId);
  if (!party) return;
  const event: GameEvent = {
    t: "chat",
    channel: "party",
    from: slot.entity.id,
    name: slot.entity.name ?? "?",
    text,
  };
  for (const memberId of party.members) {
    const member = sim.players.get(memberId);
    if (member && socialDeliveryAllowed(member, slot.entity.id)) {
      member.outbox.push(event);
    }
  }
}

function doLocalChat(sim: SimState, slot: PlayerSlot, text: string): void {
  const event: GameEvent = {
    t: "chat",
    channel: "local",
    from: slot.entity.id,
    name: slot.entity.name ?? "?",
    text,
  };
  sim.worldEvents.push({
    ev: event,
    x: slot.entity.body.x,
    y: slot.entity.body.y,
  });
}

function doGlobalChat(sim: SimState, slot: PlayerSlot, text: string): void {
  const event: GameEvent = {
    t: "chat",
    channel: "global",
    from: slot.entity.id,
    name: slot.entity.name ?? "?",
    text,
  };
  for (const other of sim.players.values()) {
    if (other.connected && socialDeliveryAllowed(other, slot.entity.id)) {
      other.outbox.push(event);
    }
  }
  sim.pendingGlobalChat.push(event);
}

function doDmChat(
  sim: SimState,
  slot: PlayerSlot,
  text: string,
  target?: string,
): void {
  if (!target) return;
  const other = resolveDmTarget(sim, slot, target);
  if (!other) return;
  const senderName = slot.entity.name ?? "?";
  const otherName = other.entity.name ?? "?";
  if (socialDeliveryAllowed(other, slot.entity.id)) {
    other.outbox.push({
      t: "chat",
      channel: "dm",
      from: slot.entity.id,
      name: senderName,
      text,
      target: senderName,
    });
  }
  slot.outbox.push({
    t: "chat",
    channel: "dm",
    from: slot.entity.id,
    name: senderName,
    text,
    target: otherName,
  });
}

function resolveDmTarget(
  sim: SimState,
  slot: PlayerSlot,
  target: string,
): PlayerSlot | null {
  if ((slot.entity.name ?? "").toLowerCase() === target.toLowerCase()) {
    slot.outbox.push(systemLine("You can't DM yourself."));
    return null;
  }
  const matches = findOnlineByName(sim, target);
  if (matches.length > 1) {
    slot.outbox.push(systemLine(
      `Multiple online players named "${target}" — be more specific.`,
    ));
    return null;
  }
  const other = matches[0];
  const isContact = slot.stored.contacts.some((contact) =>
    contact.toLowerCase() === target.toLowerCase()
  );
  if (!other || !isContact) {
    slot.outbox.push(systemLine(`You haven't fistbumped ${target} yet.`));
    return null;
  }
  if (!socialPairAllowed(slot, other)) {
    slot.outbox.push(systemLine(`Messages with ${target} are blocked.`));
    return null;
  }
  return other;
}
