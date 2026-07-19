import { TICK_RATE, type GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

/** Parties, invites, and chat (party + local fan-out). */

const INVITE_TTL_TICKS = 30 * TICK_RATE;
/** Proximity gate for inviting: roughly fistbump range, not sight range. */
const INVITE_RANGE_TILES = 6;

export function doParty(
  sim: SimState,
  slot: PlayerSlot,
  op: "invite" | "accept" | "leave",
  target?: string,
): void {
  if (op === "invite" && target) invitePlayer(sim, slot, target);
  else if (op === "accept") acceptInvite(sim, slot);
  else if (op === "leave") leaveParty(sim, slot);
}

function invitePlayer(sim: SimState, slot: PlayerSlot, target: string): void {
  const other = sim.players.get(target);
  if (!other || !other.connected) return;
  const distance = Math.hypot(
    other.entity.body.x - slot.entity.body.x,
    other.entity.body.y - slot.entity.body.y,
  );
  if (distance > INVITE_RANGE_TILES) return;
  sim.invites.set(target, { from: slot.entity.id, expiresAt: sim.tickCount + INVITE_TTL_TICKS });
  other.outbox.push({ t: "invite", from: slot.entity.id, name: slot.entity.name ?? "?" });
  slot.outbox.push({ t: "toast", msg: `Invited ${other.entity.name} to party` });
}

function acceptInvite(sim: SimState, slot: PlayerSlot): void {
  const id = slot.entity.id;
  const invite = sim.invites.get(id);
  if (!invite || invite.expiresAt < sim.tickCount) return;
  sim.invites.delete(id);
  const inviter = sim.players.get(invite.from);
  if (!inviter) return;
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

/** The inviter's existing party, or a freshly minted one containing them. */
function partyOf(sim: SimState, inviter: PlayerSlot) {
  if (inviter.partyId) return sim.parties.get(inviter.partyId)!;
  const id = `party${sim.nextPartyId++}`;
  const party = { id, members: new Set([inviter.entity.id]), roomSlot: null };
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
  channel: "party" | "local",
  text: string,
): void {
  const event: GameEvent = {
    t: "chat",
    channel,
    from: slot.entity.id,
    name: slot.entity.name ?? "?",
    text,
  };
  if (channel === "party") {
    if (!slot.partyId) return;
    const party = sim.parties.get(slot.partyId);
    if (!party) return;
    for (const memberId of party.members) sim.players.get(memberId)?.outbox.push(event);
  } else {
    sim.worldEvents.push({ ev: event, x: slot.entity.body.x, y: slot.entity.body.y });
  }
}

/** Drop invites nobody accepted in time — call once per tick. */
export function expireInvites(sim: SimState): void {
  for (const [invitee, invite] of sim.invites) {
    if (invite.expiresAt < sim.tickCount) sim.invites.delete(invitee);
  }
}
