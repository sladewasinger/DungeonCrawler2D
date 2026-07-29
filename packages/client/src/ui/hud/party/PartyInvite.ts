/** Owns an explicit yes/no party-invite prompt for the Three.js renderer. */
import type { Connection } from "../../../net/connection/connection.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class PartyInvite {
  readonly element = createHudTemplate<HTMLDivElement>("hud-party-invite-template");
  private readonly message = requireHudElement<HTMLSpanElement>(this.element, "[data-hud-party-invite-message]");
  private currentFrom: string | null = null;

  constructor(private readonly connection: Connection) {
    this.element.hidden = true;
    const accept = requireHudElement<HTMLButtonElement>(this.element, "[data-hud-party-accept]");
    const decline = requireHudElement<HTMLButtonElement>(this.element, "[data-hud-party-decline]");
    accept.addEventListener("click", () => this.respond("accept"));
    decline.addEventListener("click", () => this.respond("decline"));
  }

  update(): void {
    const invite = this.connection.pendingInvite;
    if (!invite) {
      this.currentFrom = null;
      this.element.hidden = true;
      return;
    }
    if (invite.from !== this.currentFrom) {
      this.currentFrom = invite.from;
      this.message.textContent = `${invite.name} invited you to a party.`;
    }
    this.element.hidden = false;
  }

  private respond(op: "accept" | "decline"): void {
    this.connection.partyOp(op);
    this.element.hidden = true;
    this.currentFrom = null;
  }
}
