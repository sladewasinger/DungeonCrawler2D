import { removePartyInviteState } from "../partyInviteEvents.js";
import type { SimState } from "../state.js";

export function expireInvites(sim: SimState): void {
  for (const [invitee, invite] of sim.invites) {
    if (invite.expiresAt >= sim.tickCount) continue;
    sim.invites.delete(invitee);
    removePartyInviteState(sim.players.get(invite.from), sim.players.get(invitee));
  }
}
