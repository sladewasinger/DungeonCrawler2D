/** Renders labeled party bearings and distances inside a managed HUD window. */
import type { Connection } from "../../../net/connection/connection.js";
import { createHudButton } from "../../../ui/hud/styles/HudStyles.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";
import { partyHeader, updatePartyRows, type HudPlayerPosition } from "./PartyPresentation.js";

const MAX_VISIBLE_MEMBERS = 6;

export class PartyTracker {
  readonly element = createHudTemplate<HTMLDivElement>("hud-party-tracker-template");
  private readonly title = requireHudElement<HTMLDivElement>(this.element, "[data-hud-party-title]");
  private readonly invites = requireHudElement<HTMLDivElement>(this.element, "[data-hud-party-invites]");
  private readonly members = requireHudElement<HTMLDivElement>(this.element, "[data-hud-party-members]");
  private readonly inviteButton: HTMLButtonElement;
  private readonly rows: HTMLDivElement[] = [];
  private inviteSignature = "\0";

  constructor(private readonly connection: Connection) {
    this.inviteButton = requireHudElement<HTMLButtonElement>(this.element, "[data-hud-party-invites-button]");
    this.inviteButton.addEventListener("click", () => {
      this.invites.hidden = !this.invites.hidden;
    });
    for (let index = 0; index < MAX_VISIBLE_MEMBERS; index += 1) {
      const row = createHudTemplate<HTMLDivElement>("hud-party-member-row-template");
      row.hidden = true;
      this.rows.push(row);
      this.members.append(row);
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
    this.element.hidden = !header.visible;
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
    return createHudTemplate<HTMLSpanElement>("hud-party-empty-template");
  }

  private actionRow(
    label: string,
    ...actions: Array<[string, () => void]>
  ): HTMLDivElement {
    const row = createHudTemplate<HTMLDivElement>("hud-party-action-row-template");
    const text = requireHudElement<HTMLSpanElement>(row, "[data-hud-party-action-label]");
    const buttons = requireHudElement<HTMLDivElement>(row, "[data-hud-party-action-buttons]");
    text.textContent = label;
    buttons.append(...actions.map(([name, action]) => createHudButton(name, action)));
    return row;
  }
}
