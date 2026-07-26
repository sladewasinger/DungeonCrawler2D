/** Renders labeled party bearings and distances inside a managed HUD window. */
import { INTERACT_RANGE } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import { resolvePartyNavigation } from "../ui/partyNavigation.js";
import { partyPresence } from "../ui/partyPresence.js";
import type { FirstPersonState } from "./movement.js";
import {
  HUD_PANEL,
  createHudButton,
  createHudTitle,
} from "./ThreeHudStyles.js";

const MAX_VISIBLE_MEMBERS = 6;

export class ThreePartyTracker {
  readonly element = document.createElement("div");
  private readonly title = createHudTitle("Party");
  private readonly invites = document.createElement("div");
  private readonly inviteButton: HTMLButtonElement;
  private readonly rows: HTMLDivElement[] = [];
  private inviteSignature = "\0";

  constructor(private readonly connection: Connection) {
    this.element.style.cssText = `${HUD_PANEL};display:grid;align-content:start;gap:4px`;
    const header = document.createElement("div");
    header.className = "hud-party-header";
    this.inviteButton = createHudButton("Invites", () => {
      this.invites.hidden = !this.invites.hidden;
    });
    header.append(this.title, this.inviteButton);
    this.invites.className = "hud-party-config";
    this.invites.hidden = true;
    this.element.append(header, this.invites);
    for (let index = 0; index < MAX_VISIBLE_MEMBERS; index += 1) {
      const row = document.createElement("div");
      row.hidden = true;
      this.rows.push(row);
      this.element.append(row);
    }
  }

  update(
    connection: Connection,
    player: FirstPersonState,
    yaw: number,
  ): void {
    const members = connection.party?.members.slice(0, MAX_VISIBLE_MEMBERS) ?? [];
    this.updateHeader(connection, members.length);
    this.updateInvites();
    this.updateMemberRows(connection, members, player, yaw);
  }

  private updateHeader(connection: Connection, memberCount: number): void {
    this.title.textContent = connection.party?.leaderId === connection.welcome?.playerId
      ? "Party · You lead"
      : "Party";
    const hasInvites = connection.pendingInvite !== null ||
      connection.outgoingPartyInvites.size > 0;
    this.element.style.visibility =
      memberCount > 0 || hasInvites ? "visible" : "hidden";
    this.inviteButton.textContent = hasInvites
      ? `Invites (${connection.outgoingPartyInvites.size +
        (connection.pendingInvite ? 1 : 0)})`
      : "Invites";
  }

  private updateMemberRows(
    connection: Connection,
    members: NonNullable<Connection["party"]>["members"],
    player: FirstPersonState,
    yaw: number,
  ): void {
    const viewBearingDeg = (-yaw * 180) / Math.PI;
    this.rows.forEach((row, index) => {
      const member = members[index];
      row.hidden = !member;
      if (!member) return;
      const presence = partyPresence(member.name, member.disconnected === true);
      if (member.disconnected) {
        row.textContent = presence.label;
        row.style.color = presence.color ?? "";
        return;
      }
      const navigation = resolvePartyNavigation(
        { x: player.x, y: player.z },
        member,
        viewBearingDeg,
      );
      const leader = connection.party?.leaderId === member.id ? " · LEADER" : "";
      const downed = member.downed
        ? navigation.distance <= INTERACT_RANGE ? " · REVIVE [E]" : " · DOWNED"
        : "";
      row.textContent =
        `${navigation.arrow} ${presence.label} · ${navigation.distance}m${leader}${downed}`;
      row.style.color = member.downed ? "#e96a6a" : "";
    });
  }

  private updateInvites(): void {
    const incoming = this.connection.pendingInvite;
    const outgoing = [...this.connection.outgoingPartyInvites];
    const signature = [
      incoming ? `${incoming.from}:${incoming.name}` : "",
      ...outgoing.map(([id, name]) => `${id}:${name}`),
      this.connection.party?.id ?? "",
    ].join("|");
    if (signature === this.inviteSignature) return;
    this.inviteSignature = signature;
    const rows: HTMLElement[] = [];
    if (incoming) {
      rows.push(this.actionRow(
        `${incoming.name} invited you`,
        ["Accept", () => this.connection.partyOp("accept")],
        ["Decline", () => this.connection.partyOp("decline")],
      ));
    }
    for (const [id, name] of outgoing) {
      rows.push(this.actionRow(
        `Waiting for ${name}`,
        ["Cancel", () => this.connection.partyOp("cancel", id)],
      ));
    }
    if (this.connection.party) {
      rows.push(this.actionRow(
        "Current party",
        ["Leave", () => this.connection.partyOp("leave")],
      ));
    }
    if (rows.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "No active invitations";
      empty.className = "hud-muted";
      rows.push(empty);
    }
    this.invites.replaceChildren(...rows);
  }

  private actionRow(
    label: string,
    ...actions: Array<[string, () => void]>
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "hud-party-invite-row";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(text, ...actions.map(([name, action]) =>
      createHudButton(name, action)
    ));
    return row;
  }
}
