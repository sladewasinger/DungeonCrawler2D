import type { GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

export const partyInviteState = (
  direction: "incoming" | "outgoing",
  action: "added" | "removed",
  player: PlayerSlot,
): GameEvent => ({
  t: "partyInviteState",
  direction,
  action,
  id: player.entity.id,
  name: player.entity.name ?? "Player",
});

export const removePartyInviteState = (
  inviter: PlayerSlot | undefined,
  invitee: PlayerSlot | undefined,
): void => {
  if (!inviter || !invitee) return;
  inviter.outbox.push(partyInviteState("outgoing", "removed", invitee));
  invitee.outbox.push(partyInviteState("incoming", "removed", inviter));
};

export const replayPartyInviteState = (
  sim: SimState,
  slot: PlayerSlot,
): void => {
  replayIncomingInvite(sim, slot);
  replayOutgoingInvites(sim, slot);
};

function replayIncomingInvite(sim: SimState, slot: PlayerSlot): void {
  const inviterId = sim.invites.get(slot.entity.id)?.from;
  const inviter = inviterId ? sim.players.get(inviterId) : undefined;
  if (!inviter) return;
  slot.outbox.push({ t: "invite", from: inviter.entity.id, name: inviter.entity.name ?? "?" });
  slot.outbox.push(partyInviteState("incoming", "added", inviter));
}

function replayOutgoingInvites(sim: SimState, slot: PlayerSlot): void {
  for (const [inviteeId, outgoing] of sim.invites) {
    if (outgoing.from !== slot.entity.id) continue;
    const invitee = sim.players.get(inviteeId);
    if (invitee) slot.outbox.push(partyInviteState("outgoing", "added", invitee));
  }
}
