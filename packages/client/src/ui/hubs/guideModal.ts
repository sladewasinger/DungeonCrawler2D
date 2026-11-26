/** Floor Guide Mentor Side-Quest Dialogue & Turn-in Modal [REQ-P9-13]. */
import type { ActiveQuestState } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";

export interface GuideModalActions {
  readonly onAccept: (questId: string) => void;
  readonly onClaim: (questId: string) => void;
  readonly onClose: () => void;
}

function buildQuestAction(q: ActiveQuestState, actions: GuideModalActions): HTMLButtonElement | HTMLSpanElement {
  if (q.claimed) {
    const done = domNode("span", "ow-hub-sub"); done.textContent = "Complete ✓";
    return done;
  }
  if (!q.accepted) {
    const btn = domNode("button", "ow-hub-btn"); btn.type = "button";
    btn.dataset.acceptQuest = q.id; btn.textContent = "Accept Quest";
    btn.addEventListener("click", () => actions.onAccept(q.id));
    return btn;
  }
  const btn = domNode("button", "ow-hub-btn"); btn.type = "button";
  btn.dataset.claimQuest = q.id;
  btn.textContent = q.progress >= q.required ? `Turn In (+${q.rewardGold}g)` : `${q.progress}/${q.required}`;
  btn.addEventListener("click", () => actions.onClaim(q.id));
  return btn;
}

export class GuideModal {
  readonly el: HTMLElement;
  private readonly noticeEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private noticeTimer: number | null = null;
  private lastFp = "";

  constructor(host: HTMLElement, private readonly actions: GuideModalActions) {
    this.el = domNode("section", "ow-modal ow-hub-modal ow-guide-modal");
    this.el.hidden = true;
    const head = domNode("div", "ow-modal-head");
    const title = domNode("span"); title.textContent = "Wayfarer Guide";
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

  sync(opts: { readonly open: boolean; readonly quests: readonly ActiveQuestState[] }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    const fp = opts.quests.map((q) => `${q.id}:${q.accepted}:${q.claimed}:${q.progress}`).join("|");
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    const rows = opts.quests.map((q) => {
      const row = domNode("div", "ow-hub-row");
      const txt = domNode("div", "ow-hub-text");
      const title = domNode("span", "ow-hub-title"); title.textContent = `${q.title} (${q.progress}/${q.required})`;
      const sub = domNode("span", "ow-hub-sub"); sub.textContent = `"${q.dialogue}" — ${q.hintText}`;
      txt.append(title, sub);
      row.append(txt, buildQuestAction(q, this.actions));
      return row;
    });
    this.bodyEl.replaceChildren(...rows);
  }
}
