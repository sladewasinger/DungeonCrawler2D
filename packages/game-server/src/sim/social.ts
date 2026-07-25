import { TICK_RATE, type GameEvent } from "@dc2d/engine";
import { CHAT_LIMIT, RATE_WINDOW_TICKS, findOnlineByName, withinRateLimit } from "./contacts.js";
import { socialDeliveryAllowed, socialPairAllowed } from "./moderation.js";
import type { PlayerSlot, SimState } from "./state.js";

/** Parties, invites, and chat fan-out (party/local/global/dm). Fistbump + /who
 * live in contacts.ts, as does the shared chat/who rate-limit budget. */

const INVITE_TTL_TICKS = 30 * TICK_RATE;
/** Proximity gate for inviting: roughly fistbump range, not sight range. */
const INVITE_RANGE_TILES = 6;

export function doParty(
  sim: SimState,
  slot: PlayerSlot,
  op: "invite" | "accept" | "decline" | "leave" | "kick",
  target?: string,
): void {
  if (op === "invite" && target) invitePlayer(sim, slot, target);
  else if (op === "accept") acceptInvite(sim, slot);
  else if (op === "decline") declineInvite(sim, slot);
  else if (op === "leave") leaveParty(sim, slot);
  else if (op === "kick" && target) kickMember(sim, slot, target);
}

function invitePlayer(sim: SimState, slot: PlayerSlot, target: string): void {
  const other = sim.players.get(target);
  if (!other || !other.connected) return;
  if (!socialPairAllowed(slot, other)) return;
  if (other.partyId !== null) {
    slot.outbox.push({ t: "toast", msg: `${other.entity.name ?? "Player"} is already in a party` });
    return;
  }
  if (!mayInvite(sim, slot)) return;
  const distance = Math.hypot(
    other.entity.body.x - slot.entity.body.x,
    other.entity.body.y - slot.entity.body.y,
  );
  if (distance > INVITE_RANGE_TILES) return;
  sim.invites.set(target, { from: slot.entity.id, expiresAt: sim.tickCount + INVITE_TTL_TICKS });
  other.outbox.push({ t: "invite", from: slot.entity.id, name: slot.entity.name ?? "?" });
  slot.outbox.push({ t: "toast", msg: `Invited ${other.entity.name} to party` });
}

function mayInvite(sim: SimState, slot: PlayerSlot): boolean {
  if (!slot.partyId) return true;
  const party = sim.parties.get(slot.partyId);
  if (party?.leaderId === slot.entity.id) return true;
  slot.outbox.push({ t: "toast", msg: "Only the party leader can invite" });
  return false;
}

function acceptInvite(sim: SimState, slot: PlayerSlot): void {
  const id = slot.entity.id;
  const invite = sim.invites.get(id);
  if (!invite || invite.expiresAt < sim.tickCount) return;
  sim.invites.delete(id);
  const inviter = sim.players.get(invite.from);
  if (!inviter || !inviter.connected || slot.partyId !== null || !socialPairAllowed(slot, inviter)) return;
  const party = partyOf(sim, inviter);
  party.members.add(id);
  slot.partyId = party.id;
  slot.entity.partyId = party.id;
  for (const memberId of party.members) {
    sim.players.get(memberId)?.outbox.push({
      t: "toast",
      msg: `${slot.entity.name} joined the party`,
    });
  }
}

function declineInvite(sim: SimState, slot: PlayerSlot): void {
  const invite = sim.invites.get(slot.entity.id);
  if (!invite) return;
  sim.invites.delete(slot.entity.id);
  const inviter = sim.players.get(invite.from);
  if (inviter?.connected) {
    inviter.outbox.push({
      t: "toast",
      msg: `${slot.entity.name ?? "Player"} declined the party invite`,
    });
  }
}

/** The inviter's existing party, or a freshly minted one containing them. */
function partyOf(sim: SimState, inviter: PlayerSlot) {
  if (inviter.partyId) return sim.parties.get(inviter.partyId)!;
  const id = `party${sim.nextPartyId++}`;
  const party = { id, leaderId: inviter.entity.id, members: new Set([inviter.entity.id]), roomSlot: null };
  sim.parties.set(id, party);
  inviter.partyId = id;
  inviter.entity.partyId = id;
  return party;
}

export function leaveParty(sim: SimState, slot: PlayerSlot): void {
  if (!slot.partyId) return;
  const party = sim.parties.get(slot.partyId);
  slot.partyId = null;
  delete slot.entity.partyId;
  if (!party) return;
  party.members.delete(slot.entity.id);
  for (const memberId of party.members) {
    sim.players.get(memberId)?.outbox.push({
      t: "toast",
      msg: `${slot.entity.name} left the party`,
    });
  }
  if (party.members.size <= 1) disbandParty(sim, party);
  else if (party.leaderId === slot.entity.id) {
    party.leaderId = party.members.values().next().value as string;
    sim.players.get(party.leaderId)?.outbox.push({ t: "toast", msg: "You are now party leader" });
  }
}

function kickMember(sim: SimState, leader: PlayerSlot, targetId: string): void {
  const party = leader.partyId ? sim.parties.get(leader.partyId) : undefined;
  const target = party?.members.has(targetId) ? sim.players.get(targetId) : undefined;
  if (!party || party.leaderId !== leader.entity.id || !target || target === leader) return;
  target.outbox.push({ t: "toast", msg: "You were removed from the party" });
  leaveParty(sim, target);
}

function disbandParty(sim: SimState, party: { id: string; members: Set<string> }): void {
  for (const memberId of party.members) {
    const member = sim.players.get(memberId);
    if (!member) continue;
    member.partyId = null;
    delete member.entity.partyId;
    member.outbox.push({ t: "toast", msg: "Party disbanded" });
  }
  sim.parties.delete(party.id);
}

export function doChat(
  sim: SimState,
  slot: PlayerSlot,
  channel: "party" | "local" | "global" | "dm",
  text: string,
  target?: string,
): void {
  if (!withinRateLimit(slot.chatTimestamps, sim.tickCount, RATE_WINDOW_TICKS, CHAT_LIMIT)) {
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
  const event: GameEvent = { t: "chat", channel: "party", from: slot.entity.id, name: slot.entity.name ?? "?", text };
  for (const memberId of party.members) {
    const member = sim.players.get(memberId);
    if (member && socialDeliveryAllowed(member, slot.entity.id)) member.outbox.push(event);
  }
}

function doLocalChat(sim: SimState, slot: PlayerSlot, text: string): void {
  const event: GameEvent = { t: "chat", channel: "local", from: slot.entity.id, name: slot.entity.name ?? "?", text };
  sim.worldEvents.push({ ev: event, x: slot.entity.body.x, y: slot.entity.body.y });
}

/** Truly global (ASSUMPTION #14): every connected socket on THIS sim, plus
 * (Epic 7.14) every OTHER active floor sim of the SAME level — dungeon
 * floors share one global channel; sandbox still never bleeds in, since
 * it isn't under a FloorRegistry and never drains pendingGlobalChat. The
 * cross-floor half relays with a 1-tick delay (ASSUMPTION #130,
 * docs/ASSUMPTIONS.md) — an artifact of aggregating per-sim ticks at the
 * registry level. */
function doGlobalChat(sim: SimState, slot: PlayerSlot, text: string): void {
  const event: GameEvent = { t: "chat", channel: "global", from: slot.entity.id, name: slot.entity.name ?? "?", text };
  for (const other of sim.players.values()) {
    if (other.connected && socialDeliveryAllowed(other, slot.entity.id)) other.outbox.push(event);
  }
  sim.pendingGlobalChat.push(event);
}

/** DMs require a mutual contact (ASSUMPTION #15); name matching is case-insensitive
 * exact, with an ambiguity error on multiple online matches (ASSUMPTION #17). */
function doDmChat(sim: SimState, slot: PlayerSlot, text: string, target?: string): void {
  if (!target) return;
  const other = resolveDmTarget(sim, slot, target);
  if (!other) return;
  // `target` is always "the other side of this thread" relative to
  // whichever outbox the event lands in, so either client's /r resolves
  // to the correct partner without knowing who the sender was.
  const senderName = slot.entity.name ?? "?";
  const otherName = other.entity.name ?? "?";
  if (socialDeliveryAllowed(other, slot.entity.id)) {
    other.outbox.push({ t: "chat", channel: "dm", from: slot.entity.id, name: senderName, text, target: senderName });
  }
  slot.outbox.push({ t: "chat", channel: "dm", from: slot.entity.id, name: senderName, text, target: otherName });
}

function resolveDmTarget(sim: SimState, slot: PlayerSlot, target: string): PlayerSlot | null {
  if ((slot.entity.name ?? "").toLowerCase() === target.toLowerCase()) {
    slot.outbox.push(systemLine("You can't DM yourself."));
    return null;
  }
  const matches = findOnlineByName(sim, target);
  if (matches.length > 1) {
    slot.outbox.push(systemLine(`Multiple online players named "${target}" — be more specific.`));
    return null;
  }
  const other = matches[0];
  const isContact = slot.stored.contacts.some((c) => c.toLowerCase() === target.toLowerCase());
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

function systemLine(text: string): GameEvent {
  return { t: "chat", channel: "system", from: "server", name: "system", text };
}

/** Drop invites nobody accepted in time — call once per tick. */
export function expireInvites(sim: SimState): void {
  for (const [invitee, invite] of sim.invites) {
    if (invite.expiresAt < sim.tickCount) sim.invites.delete(invitee);
  }
}
