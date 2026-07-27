import { removePartyInviteState } from "../partyInviteEvents.js";
import { socialPairAllowed } from "../moderation.js";
import type { PlayerSlot, SimState } from "../state.js";

export function acceptInvite(sim: SimState, slot: PlayerSlot): void {
  const invite = takeActiveInvite(sim, slot);
  if (!invite) return;
  const inviter = sim.players.get(invite.from);
  removePartyInviteState(inviter, slot);
  if (!canJoinParty(slot, inviter)) return;
  const party = partyOf(sim, inviter);
  party.members.add(slot.entity.id);
  slot.partyId = party.id;
  slot.entity.partyId = party.id;
  announceJoinedParty(sim, party.members, slot);
}

function takeActiveInvite(sim: SimState, slot: PlayerSlot): { from: string; expiresAt: number } | null {
  const invite = sim.invites.get(slot.entity.id);
  if (!invite || invite.expiresAt < sim.tickCount) return null;
  sim.invites.delete(slot.entity.id);
  return invite;
}

function canJoinParty(slot: PlayerSlot, inviter: PlayerSlot | undefined): inviter is PlayerSlot {
  return !!inviter && inviter.connected && slot.partyId === null && socialPairAllowed(slot, inviter);
}

function partyOf(sim: SimState, inviter: PlayerSlot) {
  if (inviter.partyId) return sim.parties.get(inviter.partyId)!;
  const id = `party${sim.nextPartyId++}`;
  const party = { id, leaderId: inviter.entity.id, members: new Set([inviter.entity.id]), roomSlot: null };
  sim.parties.set(id, party);
  inviter.partyId = id;
  inviter.entity.partyId = id;
  return party;
}

function announceJoinedParty(sim: SimState, memberIds: Set<string>, joiner: PlayerSlot): void {
  for (const memberId of memberIds) {
    sim.players.get(memberId)?.outbox.push({ t: "toast", msg: `${joiner.entity.name} joined the party` });
  }
}
