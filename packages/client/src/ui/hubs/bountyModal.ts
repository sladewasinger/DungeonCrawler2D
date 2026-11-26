/** Rotating 3-Bounty Board Modal [REQ-P9-12]. */
import type { ActiveBountyState } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";

export interface BountyModalActions {
  readonly onAccept: (bountyId: string) => void;
  readonly onClaim: (bountyId: string) => void;
  readonly onClose: () => void;
}

function buildBountyAction(b: ActiveBountyState, actions: BountyModalActions): HTMLButtonElement | HTMLSpanElement {
  if (b.claimed) {
    const done = domNode("span", "ow-hub-sub"); done.textContent = "Claimed";
    return done;
  }
  if (!b.accepted) {
    const btn = domNode("button", "ow-hub-btn"); btn.type = "button";
    btn.dataset.acceptBounty = b.id; btn.textContent = "Accept";
    btn.addEventListener("click", () => actions.onAccept(b.id));
    return btn;
  }
  const btn = domNode("button", "ow-hub-btn"); btn.type = "button";
  btn.dataset.claimBounty = b.id;
  btn.textContent = b.progress >= b.required ? `Claim (+${b.rewardGold}g)` : `${b.progress}/${b.required}`;
  btn.addEventListener("click", () => actions.onClaim(b.id));
  return btn;
}

export class BountyModal {
  readonly el: HTMLElement;
  private readonly noticeEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private noticeTimer: number | null = null;
  private lastFp = "";

  constructor(host: HTMLElement, private readonly actions: BountyModalActions) {
    this.el = domNode("section", "ow-modal ow-hub-modal ow-bounty-modal");
    this.el.hidden = true;
    const head = domNode("div", "ow-modal-head");
    const title = domNode("span"); title.textContent = "Sanctuary Bounty Board";
    const close = domNode("button", "ow-pill"); close.type = "button"; close.textContent = "Close";
    close.addEventListener("click", () => this.actions.onClose());
    head.append(title, close);
    this.noticeEl = domNode("div", "ow-hub-notice"); this.noticeEl.hidden = true;
    this.bodyEl = domNode("div", "ow-hub-scroll");
    this.el.append(head, this.noticeEl, this.bodyEl);
    host.append(this.el);
  }

  showNotice(text: string): void {
    this.noticeEl.textContent = text;
    this.noticeEl.hidden = false;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.noticeEl.hidden = true; }, 2600);
  }

  sync(opts: { readonly open: boolean; readonly bounties: readonly ActiveBountyState[] }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    const fp = opts.bounties.map((b) => `${b.id}:${b.accepted}:${b.claimed}:${b.progress}`).join("|");
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    const rows = opts.bounties.map((b) => {
      const row = domNode("div", "ow-hub-row");
      const txt = domNode("div", "ow-hub-text");
      const title = domNode("span", "ow-hub-title"); title.textContent = `${b.title} (${b.progress}/${b.required})`;
      const reward = b.rewardItemId ? ` + ${b.rewardCount ?? 1}× ${b.rewardItemId}` : "";
      const sub = domNode("span", "ow-hub-sub"); sub.textContent = `${b.description} · Reward: ${b.rewardGold}g${reward}`;
      txt.append(title, sub);
      row.append(txt, buildBountyAction(b, this.actions));
      return row;
    });
    this.bodyEl.replaceChildren(...rows);
  }
}
