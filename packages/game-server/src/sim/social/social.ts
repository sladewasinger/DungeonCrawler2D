import { TICK_RATE } from "@dc2d/engine";
import { socialPairAllowed } from "../moderation.js";
import { acceptInvite } from "./membership.js";
import {
  partyInviteState,
  removePartyInviteState,
} from "./partyInviteEvents.js";
import type { PlayerSlot, SimState } from "../state/state.js";
export { expireInvites } from "./invites.js";
export { doChat } from "./socialChat.js";

/** Parties, invites, and chat fan-out (party/local/global/dm). Fistbump + /who
 * live in contacts.ts, as does the shared chat/who rate-limit budget. */

const INVITE_TTL_TICKS = 30 * TICK_RATE;
/** Proximity gate for inviting: roughly fistbump range, not sight range. */
const INVITE_RANGE_TILES = 6;

export function doParty({ sim, slot, op, target }: {
  sim: SimState;
  slot: PlayerSlot;
  op: "invite" | "accept" | "decline" | "cancel" | "leave" | "kick";
  target?: string;
}): void {
  partyActionFor({ sim, slot, op })(target);
}

function partyActionFor({ sim, slot, op }: Omit<Parameters<typeof doParty>[0], "target">): (target?: string) => void {
  const actions = {
    invite: (target?: string) => { if (target) invitePlayer(sim, slot, target); },
    accept: () => acceptInvite(sim, slot),
    decline: () => declineInvite(sim, slot),
    cancel: (target?: string) => { if (target) cancelInvite(sim, slot, target); },
    leave: () => leaveParty(sim, slot),
    kick: (target?: string) => { if (target) kickMember(sim, slot, target); },
  };
  return actions[op];
}

function eligibleInviteTarget(
  sim: SimState,
  slot: PlayerSlot,
  target: string,
): PlayerSlot | null {
  const other = sim.players.get(target);
  if (!other || !other.connected || !socialPairAllowed(slot, other)) {
    return null;
  }
  if (other.partyId !== null) {
    slot.outbox.push({ t: "toast", msg: `${other.entity.name ?? "Player"} is already in a party` });
    return null;
  }
  return other;
}

function invitePlayer(sim: SimState, slot: PlayerSlot, target: string): void {
  const other = eligibleInviteTarget(sim, slot, target);
  if (!other) return;
  if (!mayInvite(sim, slot)) return;
  const distance = Math.hypot(
    other.entity.body.x - slot.entity.body.x,
    other.entity.body.y - slot.entity.body.y,
  );
  if (distance > INVITE_RANGE_TILES) return;
  replacePreviousInvite(sim, slot, other);
  sim.invites.set(target, { from: slot.entity.id, expiresAt: sim.tickCount + INVITE_TTL_TICKS });
  other.outbox.push({ t: "invite", from: slot.entity.id, name: slot.entity.name ?? "?" });
  other.outbox.push(partyInviteState("incoming", "added", slot));
  slot.outbox.push(partyInviteState("outgoing", "added", other));
  slot.outbox.push({ t: "toast", msg: `Invited ${other.entity.name} to party` });
}

function replacePreviousInvite(
  sim: SimState,
  slot: PlayerSlot,
  invitee: PlayerSlot,
): void {
  const previous = sim.invites.get(invitee.entity.id);
  if (!previous || previous.from === slot.entity.id) return;
  removePartyInviteState(sim.players.get(previous.from), invitee);
}

function cancelInvite(sim: SimState, slot: PlayerSlot, target: string): void {
  const invite = sim.invites.get(target);
  if (!invite || invite.from !== slot.entity.id) return;
  sim.invites.delete(target);
  const invitee = sim.players.get(target);
  removePartyInviteState(slot, invitee);
  slot.outbox.push({
    t: "toast",
    msg: `Cancelled invite to ${invitee?.entity.name ?? "Player"}`,
  });
}

function mayInvite(sim: SimState, slot: PlayerSlot): boolean {
  if (!slot.partyId) return true;
  const party = sim.parties.get(slot.partyId);
  if (party?.leaderId === slot.entity.id) return true;
  slot.outbox.push({ t: "toast", msg: "Only the party leader can invite" });
  return false;
}

function declineInvite(sim: SimState, slot: PlayerSlot): void {
  const invite = sim.invites.get(slot.entity.id);
  if (!invite) return;
  sim.invites.delete(slot.entity.id);
  const inviter = sim.players.get(invite.from);
  removePartyInviteState(inviter, slot);
  if (inviter?.connected) {
    inviter.outbox.push({
      t: "toast",
      msg: `${slot.entity.name ?? "Player"} declined the party invite`,
    });
  }
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
