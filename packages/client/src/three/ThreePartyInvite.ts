/** Owns an explicit yes/no party-invite prompt for the Three.js renderer. */
import type { Connection } from "../net/connection.js";
import { HUD_GOLD, createHudButton } from "./ThreeHudStyles.js";

export class ThreePartyInvite {
  readonly element = document.createElement("div");
  private readonly message = document.createElement("div");
  private currentFrom: string | null = null;

  constructor(private readonly connection: Connection) {
    this.element.hidden = true;
    this.element.style.cssText =
      "position:absolute;left:50%;top:18%;translate:-50% 0;z-index:1200;" +
      "min-width:260px;max-width:min(420px,80vw);padding:12px;" +
      "background:rgba(17,18,29,.96);border:1px solid #777c96;" +
      "box-shadow:0 12px 34px rgba(0,0,0,.62);pointer-events:auto;text-align:center";
    this.message.style.cssText = `margin-bottom:10px;color:${HUD_GOLD}`;
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:center;gap:8px";
    actions.append(
      createHudButton("Yes — join party", () => this.respond("accept")),
      createHudButton("No — decline", () => this.respond("decline")),
    );
    this.element.append(this.message, actions);
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
