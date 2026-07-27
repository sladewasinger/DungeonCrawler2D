/** Renders labeled party bearings and distances inside a managed HUD window. */
import type { Connection } from "../../../net/connection/connection.js";
import {
  HUD_PANEL,
  createHudButton,
  createHudTitle,
} from "../../../ui/hud/styles/HudStyles.js";
import { partyHeader, updatePartyRows, type HudPlayerPosition } from "./PartyPresentation.js";

const MAX_VISIBLE_MEMBERS = 6;

export class PartyTracker {
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
    player: HudPlayerPosition,
    yaw: number,
  ): void {
    const members = connection.party?.members.slice(0, MAX_VISIBLE_MEMBERS) ?? [];
    this.updateHeader(connection, members.length);
    this.updateInvites();
    this.updateMemberRows({ connection, members, player, yaw });
  }

  private updateHeader(connection: Connection, memberCount: number): void {
    const header = partyHeader(connection, memberCount);
    this.title.textContent = header.title;
    this.element.style.visibility = header.visible ? "visible" : "hidden";
    this.inviteButton.textContent = header.invites;
  }

  private updateMemberRows(request: Omit<Parameters<typeof updatePartyRows>[0], "rows">): void {
    updatePartyRows({ rows: this.rows, ...request });
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
    const rows = this.inviteRows(incoming, outgoing);
    this.invites.replaceChildren(...rows);
  }

  private inviteRows(incoming: Connection["pendingInvite"], outgoing: Array<[string, string]>): HTMLElement[] {
    const rows = [...this.incomingRows(incoming), ...this.outgoingRows(outgoing), ...this.partyRows()];
    return rows.length > 0 ? rows : [this.emptyInviteRow()];
  }

  private incomingRows(incoming: Connection["pendingInvite"]): HTMLDivElement[] {
    if (!incoming) return [];
    return [this.actionRow(`${incoming.name} invited you`, ["Accept", () => this.connection.partyOp("accept")], ["Decline", () => this.connection.partyOp("decline")])];
  }

  private outgoingRows(outgoing: Array<[string, string]>): HTMLDivElement[] {
    return outgoing.map(([id, name]) => this.actionRow(`Waiting for ${name}`, ["Cancel", () => this.connection.partyOp("cancel", id)]));
  }

  private partyRows(): HTMLDivElement[] {
    return this.connection.party ? [this.actionRow("Current party", ["Leave", () => this.connection.partyOp("leave")])] : [];
  }

  private emptyInviteRow(): HTMLSpanElement {
    const empty = document.createElement("span");
    empty.textContent = "No active invitations";
    empty.className = "hud-muted";
    return empty;
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
