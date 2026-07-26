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
  const incoming = sim.invites.get(slot.entity.id);
  const inviter = incoming ? sim.players.get(incoming.from) : undefined;
  if (inviter) {
    slot.outbox.push({
      t: "invite",
      from: inviter.entity.id,
      name: inviter.entity.name ?? "?",
    });
    slot.outbox.push(partyInviteState("incoming", "added", inviter));
  }
  for (const [inviteeId, outgoing] of sim.invites) {
    if (outgoing.from !== slot.entity.id) continue;
    const invitee = sim.players.get(inviteeId);
    if (invitee) {
      slot.outbox.push(partyInviteState("outgoing", "added", invitee));
    }
  }
};
