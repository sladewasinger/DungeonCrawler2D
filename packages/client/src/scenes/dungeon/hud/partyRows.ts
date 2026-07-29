import { INTERACT_RANGE, type ServerSnapshot } from "@dc2d/engine";
import { resolvePartyNavigation } from "../../../ui/presentation/partyNavigation.js";
import type { PartyRowData } from "../../../ui/widgets/hud/social/partyFrames.js";

export interface PartyRowsView {
  rows: PartyRowData[];
  selfIsLeader: boolean;
}

export interface PartyRowsSource {
  readonly party: ServerSnapshot["party"];
  readonly selfId: string | null;
  readonly bodyPos: { x: number; y: number };
  readonly viewBearingDeg: number;
}

export function partyRowsView(source: PartyRowsSource): PartyRowsView {
  const { party, selfId, bodyPos, viewBearingDeg } = source;
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
