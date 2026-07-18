import { TICK_RATE, type GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state";

/** Parties, invites, and chat. */

const INVITE_TTL_TICKS = 30 * TICK_RATE;

export function doParty(
  sim: SimState,
  slot: PlayerSlot,
  op: "invite" | "accept" | "leave",
  target?: string,
): void {
  const id = slot.entity.id;
  if (op === "invite" && target) {
    const other = sim.players.get(target);
    if (!other || !other.connected) return;
    const d = Math.hypot(
      other.entity.body.x - slot.entity.body.x,
      other.entity.body.y - slot.entity.body.y,
    );
    if (d > 6) return; // fistbump range-ish: you invite people you can see
    sim.invites.set(target, { from: id, expiresAt: sim.tickCount + INVITE_TTL_TICKS });
    other.outbox.push({ t: "invite", from: id, name: slot.entity.name ?? "?" });
    slot.outbox.push({ t: "toast", msg: `Invited ${other.entity.name} to party` });
    return;
  }
  if (op === "accept") {
    const invite = sim.invites.get(id);
    if (!invite || invite.expiresAt < sim.tickCount) return;
    sim.invites.delete(id);
    const inviter = sim.players.get(invite.from);
    if (!inviter) return;
    let partyId = inviter.partyId;
    if (!partyId) {
      partyId = `party${sim.nextPartyId++}`;
      sim.parties.set(partyId, { id: partyId, members: new Set([invite.from]), roomSlot: null });
      inviter.partyId = partyId;
      inviter.entity.partyId = partyId;
    }
    const party = sim.parties.get(partyId)!;
    party.members.add(id);
    slot.partyId = partyId;
    slot.entity.partyId = partyId;
    for (const memberId of party.members) {
      sim.players.get(memberId)?.outbox.push({
        t: "toast",
        msg: `${slot.entity.name} joined the party`,
      });
    }
    return;
  }
  if (op === "leave") leaveParty(sim, slot);
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
  if (party.members.size <= 1) {
    for (const memberId of party.members) {
      const member = sim.players.get(memberId);
      if (member) {
        member.partyId = null;
        delete member.entity.partyId;
        member.outbox.push({ t: "toast", msg: "Party disbanded" });
      }
    }
    sim.parties.delete(party.id);
  }
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

export function expireInvites(sim: SimState): void {
  for (const [invitee, invite] of sim.invites) {
    if (invite.expiresAt < sim.tickCount) sim.invites.delete(invitee);
  }
}
