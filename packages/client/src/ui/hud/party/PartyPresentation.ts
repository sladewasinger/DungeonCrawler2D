import { INTERACT_RANGE } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import { resolvePartyNavigation } from "../../../ui/presentation/partyNavigation.js";
import { partyPresence } from "../../../ui/presentation/partyPresence.js";

export interface HudPlayerPosition {
  x: number;
  z: number;
}

export interface PartyRowsRequest {
  rows: HTMLDivElement[];
  connection: Connection;
  members: NonNullable<Connection["party"]>["members"];
  player: HudPlayerPosition;
  yaw: number;
}

export const updatePartyRows = ({ rows, connection, members, player, yaw }: PartyRowsRequest): void => {
  const bearing = (-yaw * 180) / Math.PI;
  rows.forEach((row, index) => updatePartyRow({ row, member: members[index], connection, player, bearing }));
};

const updatePartyRow = ({ row, member, connection, player, bearing }: {
  row: HTMLDivElement;
  member: PartyRowsRequest["members"][number] | undefined;
  connection: Connection;
  player: HudPlayerPosition;
  bearing: number;
}): void => {
  row.hidden = !member;
  if (!member) return;
  const presence = partyPresence(member.name, member.disconnected === true);
  if (member.disconnected) return showDisconnectedRow(row, presence);
  const navigation = resolvePartyNavigation({ x: player.x, y: player.z }, member, bearing);
  const leader = connection.party?.leaderId === member.id ? " · LEADER" : "";
  const downed = member.downed ? downedText(navigation.distance) : "";
  row.textContent = `${navigation.arrow} ${presence.label} · ${navigation.distance}m${leader}${downed}`;
  row.style.color = member.downed ? "#e96a6a" : "";
};

const showDisconnectedRow = (row: HTMLDivElement, presence: ReturnType<typeof partyPresence>): void => {
  row.textContent = presence.label;
  row.style.color = presence.color ?? "";
};

const downedText = (distance: number): string => distance <= INTERACT_RANGE ? " · REVIVE [E]" : " · DOWNED";

export const partyHeader = (connection: Connection, members: number): { title: string; visible: boolean; invites: string } => {
  const incoming = connection.pendingInvite ? 1 : 0;
  const outgoing = connection.outgoingPartyInvites.size;
  const inviteCount = incoming + outgoing;
  return {
    title: connection.party?.leaderId === connection.welcome?.playerId ? "Party · You lead" : "Party",
    visible: members > 0 || inviteCount > 0,
    invites: inviteCount > 0 ? `Invites (${inviteCount})` : "Invites",
  };
};
