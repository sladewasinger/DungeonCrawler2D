import { INTERACT_RANGE, type ServerSnapshot } from "@dc2d/engine";
import { resolvePartyNavigation } from "../../ui/partyNavigation.js";
import type { PartyRowData } from "../../ui/widgets/hud/partyFrames.js";

export interface PartyRowsView {
  rows: PartyRowData[];
  selfIsLeader: boolean;
}

export function partyRowsView(
  party: ServerSnapshot["party"],
  selfId: string | null,
  bodyPos: { x: number; y: number },
  viewBearingDeg: number,
): PartyRowsView {
  if (!party) return { rows: [], selfIsLeader: false };
  return {
    selfIsLeader: party.leaderId === selfId,
    rows: party.members.map((member) => {
      const navigation = resolvePartyNavigation(bodyPos, member, viewBearingDeg);
      return {
        id: member.id,
        name: member.name,
        hp: member.hp,
        maxHp: member.maxHp,
        downed: member.downed,
        disconnected: member.disconnected ?? false,
        leader: party.leaderId === member.id,
        revive: member.downed && navigation.distance <= INTERACT_RANGE,
        ...navigation,
      };
    }),
  };
}
