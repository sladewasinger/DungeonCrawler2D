/** Merchant Supply Buy & Bag Sell Modal [REQ-P9-08][REQ-P9-09]. */
import { computeSellPrice, getItemDef, resolveItemInstance, resolveMerchantCatalog } from "@dc2d/content";
import type { InventorySnapshot } from "@dc2d/engine";
import { domNode } from "../hud/slotRenderer.js";
import { getItemIconUrl } from "../icons/itemIcons.js";

const CLS_SUB = "ow-hub-sub";

export interface MerchantModalActions {
  readonly onBuy: (offerId: string, count: number) => void;
  readonly onSell: (slotIndex: number) => void;
  readonly onClose: () => void;
}

export class MerchantModal {
  readonly el: HTMLElement;
  private readonly goldEl: HTMLSpanElement;
  private readonly noticeEl: HTMLDivElement;
  private readonly buyBtn: HTMLButtonElement;
  private readonly sellBtn: HTMLButtonElement;
  private readonly bodyEl: HTMLDivElement;
  private tab: "buy" | "sell" = "buy";
  private noticeTimer: number | null = null;
  private lastFp = "";

  constructor(host: HTMLElement, private readonly actions: MerchantModalActions) {
    this.el = domNode("section", "ow-modal ow-hub-modal ow-merchant-modal");
    this.el.hidden = true;
    const head = domNode("div", "ow-modal-head");
    const title = domNode("span"); title.textContent = "Quartermaster Merchant";
    const right = domNode("div"); right.style.display = "flex"; right.style.gap = "6px"; right.style.alignItems = "center";
    this.goldEl = domNode("span", "ow-gold-badge");
    const close = domNode("button", "ow-pill"); close.type = "button"; close.textContent = "Close";
    close.addEventListener("click", () => this.actions.onClose());
    right.append(this.goldEl, close);
    head.append(title, right);

    const tabs = domNode("div", "ow-hub-tabs");
    this.buyBtn = domNode("button", "ow-pill ow-hub-tab"); this.buyBtn.type = "button"; this.buyBtn.textContent = "Buy";
    this.sellBtn = domNode("button", "ow-pill ow-hub-tab"); this.sellBtn.type = "button"; this.sellBtn.textContent = "Sell Bag";
    this.buyBtn.addEventListener("click", () => { this.tab = "buy"; this.lastFp = ""; });
    this.sellBtn.addEventListener("click", () => { this.tab = "sell"; this.lastFp = ""; });
    tabs.append(this.buyBtn, this.sellBtn);

    this.noticeEl = domNode("div", "ow-hub-notice"); this.noticeEl.hidden = true;
    this.bodyEl = domNode("div", "ow-hub-scroll");
    this.el.append(head, tabs, this.noticeEl, this.bodyEl);
    host.append(this.el);
  }

  showNotice(text: string): void {
    this.noticeEl.textContent = text;
    this.noticeEl.hidden = false;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.noticeEl.hidden = true; }, 2600);
  }

  sync(opts: { readonly open: boolean; readonly gold: number; readonly inv: InventorySnapshot; readonly worldSeed: number }): void {
    this.el.hidden = !opts.open;
    if (!opts.open) return;
    this.goldEl.textContent = `${opts.gold} Gold`;
    this.buyBtn.dataset.active = String(this.tab === "buy");
    this.sellBtn.dataset.active = String(this.tab === "sell");
    const bagFp = opts.inv.slots.map((s) => (s ? `${s.itemId}:${s.count}:${s.upgradeLevel ?? 0}` : "-")).join("|");
    const fp = `${this.tab}:${opts.gold}:${opts.worldSeed}:${bagFp}`;
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    if (this.tab === "buy") this.renderBuyList(opts.worldSeed);
    else this.renderSellList(opts.inv);
  }

  private renderBuyList(worldSeed: number): void {
    const rows = resolveMerchantCatalog(worldSeed).map((offer) => {
      const def = getItemDef(offer.itemId);
      const row = domNode("div", "ow-hub-row");
      const meta = domNode("div", "ow-hub-meta");
      const icon = domNode("img", "ow-hub-icon"); icon.src = getItemIconUrl(offer.itemId); icon.alt = def?.name ?? offer.itemId;
      const txt = domNode("div", "ow-hub-text");
      const title = domNode("span", "ow-hub-title"); title.textContent = `${def?.name ?? offer.itemId}${offer.quantity > 1 ? ` ×${offer.quantity}` : ""}`;
      const sub = domNode("span", CLS_SUB); sub.textContent = `${offer.goldCost} Gold${offer.rotating ? " · Rotating Curio" : ""}`;
      txt.append(title, sub); meta.append(icon, txt);
      const btn = domNode("button", "ow-hub-btn"); btn.type = "button"; btn.dataset.offerId = offer.id;
      btn.textContent = `Buy (${offer.goldCost}g)`;
      btn.addEventListener("click", () => this.actions.onBuy(offer.id, 1));
      row.append(meta, btn);
      return row;
    });
    this.bodyEl.replaceChildren(...rows);
  }

  private renderSellList(inv: InventorySnapshot): void {
    const rows: HTMLElement[] = [];
    inv.slots.forEach((slot, idx) => {
      if (!slot) return;
      const resolved = resolveItemInstance(slot.itemId, slot.prefixId);
      const unitPrice = computeSellPrice(slot);
      const total = unitPrice * slot.count;
      const row = domNode("div", "ow-hub-row");
      const meta = domNode("div", "ow-hub-meta");
      const icon = domNode("img", "ow-hub-icon"); icon.src = getItemIconUrl(slot.itemId); icon.alt = resolved.displayName;
      const txt = domNode("div", "ow-hub-text");
      const upg = slot.upgradeLevel ? ` +${slot.upgradeLevel}` : "";
      const title = domNode("span", "ow-hub-title"); title.textContent = `${resolved.displayName}${upg}${slot.count > 1 ? ` ×${slot.count}` : ""}`;
      const sub = domNode("span", CLS_SUB); sub.textContent = `Sells for ${total} Gold`;
      txt.append(title, sub); meta.append(icon, txt);
      const btn = domNode("button", "ow-hub-btn"); btn.type = "button"; btn.dataset.sellSlot = String(idx);
      btn.textContent = `Sell (+${total}g)`;
      btn.addEventListener("click", () => this.actions.onSell(idx));
      row.append(meta, btn);
      rows.push(row);
    });
    if (rows.length === 0) {
      const empty = domNode("div", CLS_SUB); empty.textContent = "Your bag is empty."; rows.push(empty);
    }
    this.bodyEl.replaceChildren(...rows);
  }
}
