/** Blacksmith Reforge & +1..+3 Gear Upgrade Modal [REQ-P9-10][REQ-P9-11]. */
import {
  computeReforgeCost, computeUpgradeCost, isItemReforgeableOrUpgradeable, resolveItemInstance,
} from "@dc2d/content";
import type { InventorySnapshot, SlotItem } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";
import { getItemIconUrl } from "../icons/itemIcons.js";

export interface BlacksmithModalActions {
  readonly onReforge: (slotIndex: number) => void;
  readonly onUpgrade: (slotIndex: number) => void;
  readonly onClose: () => void;
}

function buildGearRow(opts: {
  readonly slotIndex: number; readonly item: SlotItem;
  readonly onReforge: (slot: number) => void; readonly onUpgrade: (slot: number) => void;
}): HTMLDivElement {
  const { slotIndex, item } = opts;
  const resolved = resolveItemInstance(item.itemId, item.prefixId);
  const lv = item.upgradeLevel ?? 0;
  const rfCost = computeReforgeCost({ itemId: item.itemId, prefixId: item.prefixId });
  const upCost = computeUpgradeCost(lv);

  const row = domNode("div", "ow-hub-row");
  const meta = domNode("div", "ow-hub-meta");
  const icon = domNode("img", "ow-hub-icon"); icon.src = getItemIconUrl(item.itemId); icon.alt = resolved.displayName;
  const txt = domNode("div", "ow-hub-text");
  const title = domNode("span", "ow-hub-title"); title.textContent = `${resolved.displayName}${lv > 0 ? ` +${lv}` : ""}`;
  const sub = domNode("span", "ow-hub-sub");
  sub.textContent = upCost
    ? `Reforge: ${rfCost.gold}g+1 ${rfCost.material.itemId} · +${upCost.nextLevel}: ${upCost.gold}g+${upCost.material.count} ${upCost.material.itemId}`
    : `Reforge: ${rfCost.gold}g+1 ${rfCost.material.itemId} · Max Level (+3)`;
  txt.append(title, sub); meta.append(icon, txt);

  const reforgeBtn = domNode("button", "ow-hub-btn"); reforgeBtn.type = "button";
  reforgeBtn.dataset.reforgeSlot = String(slotIndex);
  reforgeBtn.textContent = "Reforge";
  reforgeBtn.addEventListener("click", () => opts.onReforge(slotIndex));

  const upBtn = domNode("button", "ow-hub-btn"); upBtn.type = "button";
  upBtn.dataset.upgradeSlot = String(slotIndex);
  upBtn.textContent = upCost ? `Upgrade +${upCost.nextLevel}` : "Max +3";
  upBtn.addEventListener("click", () => opts.onUpgrade(slotIndex));

  row.append(meta, reforgeBtn, upBtn);
  return row;
}

export class BlacksmithModal {
  readonly el: HTMLElement;
  private readonly goldEl: HTMLSpanElement;
  private readonly noticeEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private noticeTimer: number | null = null;
  private lastFp = "";

  constructor(host: HTMLElement, private readonly actions: BlacksmithModalActions) {
    this.el = domNode("section", "ow-modal ow-hub-modal ow-blacksmith-modal");
    this.el.hidden = true;
    const head = domNode("div", "ow-modal-head");
    const title = domNode("span"); title.textContent = "Sanctuary Blacksmith";
    const right = domNode("div"); right.style.display = "flex"; right.style.gap = "6px"; right.style.alignItems = "center";
    this.goldEl = domNode("span", "ow-gold-badge");
    const close = domNode("button", "ow-pill"); close.type = "button"; close.textContent = "Close";
    close.addEventListener("click", () => this.actions.onClose());
    right.append(this.goldEl, close);
    head.append(title, right);
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

  sync(opts: { readonly open: boolean; readonly gold: number; readonly inv: InventorySnapshot }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    this.goldEl.textContent = `${opts.gold} Gold`;
    const fp = `${opts.gold}|${opts.inv.slots.map((s) => (s ? `${s.itemId}:${s.prefixId ?? ""}:${s.upgradeLevel ?? 0}:${s.count}` : "-")).join(",")}`;
    if (fp === this.lastFp) return;
    this.lastFp = fp;

    const rows: HTMLElement[] = [];
    opts.inv.slots.forEach((item, idx) => {
      if (item && isItemReforgeableOrUpgradeable(item.itemId)) {
        rows.push(buildGearRow({ slotIndex: idx, item, onReforge: this.actions.onReforge, onUpgrade: this.actions.onUpgrade }));
      }
    });
    if (rows.length === 0) {
      const empty = domNode("div", "ow-hub-sub");
      empty.textContent = "Unequip or carry a weapon, tool, or armor piece in your bag to reforge or upgrade.";
      rows.push(empty);
    }
    this.bodyEl.replaceChildren(...rows);
  }
}
