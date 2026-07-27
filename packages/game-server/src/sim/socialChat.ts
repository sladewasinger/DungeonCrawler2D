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

interface ChatRequest {
  sim: SimState;
  slot: PlayerSlot;
  channel: "party" | "local" | "global" | "dm";
  text: string;
  target?: string | undefined;
}

type ChatHandler = (request: ChatRequest) => void;

export function doChat(request: ChatRequest): void {
  const { sim, slot } = request;
  if (!withinRateLimit({
    timestamps: slot.chatTimestamps,
    nowTick: sim.tickCount,
    windowTicks: RATE_WINDOW_TICKS,
    limit: CHAT_LIMIT,
  })) {
    slot.outbox.push(systemLine("You're sending messages too fast — slow down."));
    return;
  }
  chatHandlers[request.channel](request);
}

const chatHandlers: Record<ChatRequest["channel"], ChatHandler> = {
  party: doPartyChat,
  local: doLocalChat,
  global: doGlobalChat,
  dm: doDmChat,
};

function doPartyChat({ sim, slot, text }: ChatRequest): void {
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
    deliverPartyChat(sim.players.get(memberId), slot.entity.id, event);
  }
}

function deliverPartyChat(recipient: PlayerSlot | undefined, senderId: string, event: GameEvent): void {
  if (recipient && socialDeliveryAllowed(recipient, senderId)) recipient.outbox.push(event);
}

function doLocalChat({ sim, slot, text }: ChatRequest): void {
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

function doGlobalChat({ sim, slot, text }: ChatRequest): void {
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

function doDmChat({ sim, slot, text, target }: ChatRequest): void {
  if (!target) return;
  const other = resolveDmTarget(sim, slot, target);
  if (!other) return;
  sendDmToRecipient(slot, other, text);
  sendDmConfirmation(slot, other, text);
}

function sendDmToRecipient(sender: PlayerSlot, recipient: PlayerSlot, text: string): void {
  if (!socialDeliveryAllowed(recipient, sender.entity.id)) return;
  const senderName = sender.entity.name ?? "?";
  recipient.outbox.push({ t: "chat", channel: "dm", from: sender.entity.id, name: senderName, text, target: senderName });
}

function sendDmConfirmation(sender: PlayerSlot, recipient: PlayerSlot, text: string): void {
  sender.outbox.push({
    t: "chat", channel: "dm", from: sender.entity.id, name: sender.entity.name ?? "?", text,
    target: recipient.entity.name ?? "?",
  });
}

function resolveDmTarget(
  sim: SimState,
  slot: PlayerSlot,
  target: string,
): PlayerSlot | null {
  if (isSelfDm(slot, target)) return rejectDm(slot, "You can't DM yourself.");
  const matches = findOnlineByName(sim, target);
  if (matches.length > 1) return rejectDm(slot, `Multiple online players named "${target}" — be more specific.`);
  const other = matches[0];
  if (!other || !isContact(slot, target)) return rejectDm(slot, `You haven't fistbumped ${target} yet.`);
  if (!socialPairAllowed(slot, other)) return rejectDm(slot, `Messages with ${target} are blocked.`);
  return other;
}

function isSelfDm(slot: PlayerSlot, target: string): boolean {
  return (slot.entity.name ?? "").toLowerCase() === target.toLowerCase();
}

function isContact(slot: PlayerSlot, target: string): boolean {
  return slot.stored.contacts.some((contact) => contact.toLowerCase() === target.toLowerCase());
}

function rejectDm(slot: PlayerSlot, message: string): null {
  slot.outbox.push(systemLine(message));
  return null;
}
