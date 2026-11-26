/** Personal 27-slot cross-floor Sanctuary Stash Modal [REQ-P9-06]. */
import {
  BACKPACK_SLOT_COUNT, HOTBAR_SLOT_COUNT, STASH_SLOT_COUNT,
  type InventorySlot, type InventorySnapshot,
} from "@dc2d/engine";
import { domNode, renderSlotContent, slotsFingerprint } from "../hud/slotRenderer.js";

export interface StashModalActions {
  readonly onQuickMove: (req: { readonly from: "stash" | "inv"; readonly slotIndex: number }) => void;
  readonly onTakeAll: () => void;
  readonly onClose: () => void;
}

function makeStashGrid(opts: {
  readonly title: string; readonly count: number; readonly kind: "stash" | "inv";
  readonly onQuickMove: StashModalActions["onQuickMove"]; readonly out: HTMLButtonElement[];
}): HTMLDivElement {
  const pane = domNode("div", "ow-chest-pane");
  const lbl = domNode("div", "ow-chest-lbl"); lbl.textContent = opts.title;
  const grid = domNode("div", "ow-backpack-grid");
  for (let i = 0; i < opts.count; i++) {
    const idx = opts.kind === "inv" ? HOTBAR_SLOT_COUNT + i : i;
    const btn = domNode("button", "ow-slot ow-bag-slot"); btn.type = "button";
    btn.setAttribute("aria-label", `${opts.kind === "stash" ? "Stash" : "Backpack"} slot ${i + 1}`);
    btn.addEventListener("click", () => opts.onQuickMove({ from: opts.kind, slotIndex: idx }));
    opts.out.push(btn);
    grid.append(btn);
  }
  pane.append(lbl, grid);
  return pane;
}

export class StashModal {
  readonly el: HTMLElement;
  private readonly stashButtons: HTMLButtonElement[] = [];
  private readonly bagButtons: HTMLButtonElement[] = [];
  private readonly stashKeys: string[] = Array.from({ length: STASH_SLOT_COUNT }, () => "");
  private readonly bagKeys: string[] = Array.from({ length: BACKPACK_SLOT_COUNT }, () => "");
  private lastFp = "";

  constructor(host: HTMLElement, private readonly actions: StashModalActions) {
    this.el = domNode("section", "ow-modal ow-stash-modal");
    this.el.hidden = true;
    const head = domNode("div", "ow-modal-head");
    const title = domNode("span"); title.textContent = "Sanctuary Stash (Personal)";
    const right = domNode("div"); right.style.display = "flex"; right.style.gap = "6px";
    const takeAll = domNode("button", "ow-pill"); takeAll.type = "button"; takeAll.textContent = "Take All";
    takeAll.addEventListener("click", () => this.actions.onTakeAll());
    const close = domNode("button", "ow-pill"); close.type = "button"; close.textContent = "Close";
    close.addEventListener("click", () => this.actions.onClose());
    right.append(takeAll, close);
    head.append(title, right);

    const body = domNode("div", "ow-chest-body");
    body.append(
      makeStashGrid({ title: "Stash Vault (Tap item to withdraw)", count: STASH_SLOT_COUNT, kind: "stash", onQuickMove: actions.onQuickMove, out: this.stashButtons }),
      makeStashGrid({ title: "Backpack (Tap item to deposit)", count: BACKPACK_SLOT_COUNT, kind: "inv", onQuickMove: actions.onQuickMove, out: this.bagButtons }),
    );
    this.el.append(head, body);
    host.append(this.el);
  }

  sync(opts: { readonly open: boolean; readonly stash: readonly InventorySlot[]; readonly inv: InventorySnapshot }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    const sFp = slotsFingerprint(opts.stash, 0, STASH_SLOT_COUNT);
    const bFp = slotsFingerprint(opts.inv.slots, HOTBAR_SLOT_COUNT, BACKPACK_SLOT_COUNT);
    const fp = `${sFp}#${bFp}`;
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    syncCellList(this.stashButtons, { cache: this.stashKeys, slots: opts.stash, offset: 0 });
    syncCellList(this.bagButtons, { cache: this.bagKeys, slots: opts.inv.slots, offset: HOTBAR_SLOT_COUNT });
  }
}

function syncCellList(buttons: readonly HTMLButtonElement[], opts: {
  readonly cache: string[]; readonly slots: readonly InventorySlot[]; readonly offset: number;
}): void {
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    if (!btn) continue;
    const item = opts.slots[opts.offset + i] ?? null;
    const key = item ? `${item.itemId}:${item.count}:${item.prefixId ?? ""}:${item.upgradeLevel ?? 0}` : "-";
    if (opts.cache[i] === key) continue;
    opts.cache[i] = key;
    renderSlotContent(btn, { item });
  }
}
