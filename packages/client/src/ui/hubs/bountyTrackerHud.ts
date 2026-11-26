/** Compact HUD tracker pinned for accepted active Bounties [REQ-P9-12]. */
import type { ActiveBountyState } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";

export class BountyTrackerHud {
  readonly el: HTMLDivElement;
  private readonly rowsEl: HTMLDivElement;
  private collapsed = false;
  private lastKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-bounty-hud");
    this.el.hidden = true;
    const head = domNode("div", "ow-bounty-hud-head");
    const label = domNode("span");
    label.textContent = "Bounties";
    const toggle = domNode("button", "ow-pill");
    toggle.type = "button";
    toggle.textContent = "−";
    toggle.addEventListener("pointerdown", (e) => e.stopPropagation());
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapsed = !this.collapsed;
      this.rowsEl.hidden = this.collapsed;
      toggle.textContent = this.collapsed ? "+" : "−";
    });
    head.append(label, toggle);
    this.rowsEl = domNode("div");
    this.el.append(head, this.rowsEl);
    host.append(this.el);
  }

  sync(bounties: readonly ActiveBountyState[]): void {
    const active = bounties.filter((b) => b.accepted && !b.claimed).slice(0, 2);
    this.el.hidden = active.length === 0;
    if (active.length === 0) { this.lastKey = ""; return; }
    const key = active.map((b) => `${b.id}:${b.progress}:${b.required}`).join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.rowsEl.replaceChildren(...active.map((b) => {
      const row = domNode("div", "ow-bounty-hud-line");
      const name = domNode("span");
      name.textContent = b.title;
      const prog = domNode("span");
      prog.textContent = b.progress >= b.required ? "Ready!" : `${b.progress}/${b.required}`;
      row.append(name, prog);
      return row;
    }));
  }
}
