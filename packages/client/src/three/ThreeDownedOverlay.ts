/** Owns the first-person downed/death message without adding layout logic to ThreeHud. */
import type { Connection } from "../net/connection.js";

export class ThreeDownedOverlay {
  readonly element = document.createElement("div");

  constructor(parent: HTMLElement) {
    this.element.style.cssText =
      "position:absolute;inset:0;display:grid;place-items:center;white-space:pre-line;text-align:center;" +
      "font:700 18px monospace;color:#f2e9e2;background:rgba(18,4,8,.38);pointer-events:none";
    this.element.hidden = true;
    parent.append(this.element);
  }

  update(connection: Connection): void {
    this.element.hidden = !connection.downed && !connection.dead;
    this.element.textContent = connection.downed
      ? "DOWNED\nHold [K] to give up\nA party member can revive you"
      : "YOU DIED\nRespawning...";
  }
}
