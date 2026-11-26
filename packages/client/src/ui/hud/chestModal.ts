/** Minecraft-style bidirectional 27-slot Chest <-> 27-slot Backpack modal (bottom hotbar stays active). */
import {
  BACKPACK_SLOT_COUNT, CHEST_SLOT_COUNT, HOTBAR_SLOT_COUNT, getPoiCatalogEntry,
  type InventorySnapshot, type PoiKind, type WorldChestSnapshot,
} from "@dc2d/engine";
import type { DragSource, SlotDragManager } from "./slotDragManager.js";
import { domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

const TAG_DIV = "div";
const TAG_BTN = "button";
const CLS_SLOT = "ow-slot ow-bag-slot";

function chestTitleForKind(poiKind: string): string {
  if (poiKind === "player-chest") return "Storage Chest";
  return getPoiCatalogEntry(poiKind as PoiKind).displayName;
}

function tapFp(tap: DragSource | null): string {
  if (!tap) return "-";
  return `${tap.kind}:${tap.kind === "armor" ? tap.armorSlot : tap.index}`;
}

export class ChestModal {
  readonly el: HTMLElement;
  private readonly titleEl: HTMLSpanElement;
  private readonly noticeEl: HTMLSpanElement;
  private readonly chestButtons: HTMLButtonElement[] = [];
  private readonly bagButtons: HTMLButtonElement[] = [];
  private readonly chestKeys: string[] = Array.from({ length: CHEST_SLOT_COUNT }, () => "");
  private readonly bagKeys: string[] = Array.from({ length: BACKPACK_SLOT_COUNT }, () => "");
  private noticeTimer: number | null = null;
  private lastFp = "";

  constructor(
    host: HTMLElement,
    drag: SlotDragManager,
    opts: { readonly onTakeAll: () => void; readonly onClose: () => void },
  ) {
    this.el = domNode("section", "ow-modal ow-chest-modal");
    this.el.hidden = true;
    const { header, titleEl, noticeEl } = buildChestHeader(opts);
    this.titleEl = titleEl;
    this.noticeEl = noticeEl;
    const body = domNode(TAG_DIV, "ow-chest-body");
    body.append(
      this.buildPane({ title: "Chest (Drag, Right-click, or Shift-click)", count: CHEST_SLOT_COUNT, kind: "chest", drag, out: this.chestButtons }),
      this.buildPane({ title: "Backpack (Hotbar below)", count: BACKPACK_SLOT_COUNT, kind: "slot", drag, out: this.bagButtons }),
    );
    this.el.append(header, body);
    host.append(this.el);
  }

  showNotice(text: string): void {
    this.noticeEl.textContent = text;
    this.noticeEl.hidden = false;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.noticeEl.hidden = true; this.noticeTimer = null; }, 2400);
  }

  private buildPane(opts: {
    readonly title: string; readonly count: number; readonly kind: "chest" | "slot";
    readonly drag: SlotDragManager; readonly out: HTMLButtonElement[];
  }): HTMLDivElement {
    const pane = domNode(TAG_DIV, "ow-chest-pane");
    pane.dataset.dropZone = opts.kind === "chest" ? "chest" : "backpack";
    const lbl = domNode(TAG_DIV, "ow-chest-lbl");
    lbl.textContent = opts.title;
    const grid = domNode(TAG_DIV, "ow-backpack-grid");
    for (let i = 0; i < opts.count; i++) {
      const btn = domNode(TAG_BTN, CLS_SLOT);
      btn.type = TAG_BTN;
      const idx = opts.kind === "slot" ? HOTBAR_SLOT_COUNT + i : i;
      btn.setAttribute("aria-label", `${opts.kind === "chest" ? "Chest" : "Backpack"} slot ${i + 1}`);
      opts.drag.bindSlot(btn, { kind: opts.kind, index: idx });
      opts.out.push(btn);
      grid.append(btn);
    }
    pane.append(lbl, grid);
    return pane;
  }

  sync(opts: {
    readonly chest: WorldChestSnapshot | undefined; readonly inv: InventorySnapshot;
    readonly open: boolean; readonly tapSource: DragSource | null;
  }): void {
    this.el.hidden = !opts.open || !opts.chest;
    if (this.el.hidden || !opts.chest) { this.noticeEl.hidden = true; return; }
    this.titleEl.textContent = chestTitleForKind(opts.chest.poiKind);
    const cFp = slotsFingerprint(opts.chest.slots, 0, CHEST_SLOT_COUNT);
    const bFp = slotsFingerprint(opts.inv.slots, HOTBAR_SLOT_COUNT, BACKPACK_SLOT_COUNT);
    const fp = `${opts.chest.id}#${cFp}#${bFp}#${tapFp(opts.tapSource)}`;
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    syncSlotGrid(this.chestButtons, { cache: this.chestKeys, slots: opts.chest.slots, offset: 0, tapKind: "chest", tapSource: opts.tapSource });
    syncSlotGrid(this.bagButtons, { cache: this.bagKeys, slots: opts.inv.slots, offset: HOTBAR_SLOT_COUNT, tapKind: "slot", tapSource: opts.tapSource });
  }
}

function syncSingleCell(btn: HTMLButtonElement | undefined, opts: {
  readonly cache: string[]; readonly index: number;
  readonly item: InventorySnapshot["slots"][number] | null; readonly tap: boolean;
}): void {
  if (!btn) return;
  const key = opts.item ? `${opts.item.itemId}:${opts.item.count}:${opts.item.prefixId ?? ""}` : "-";
  if (opts.cache[opts.index] === key) { btn.dataset.tapSource = String(opts.tap); return; }
  opts.cache[opts.index] = key;
  renderSlotContent(btn, { item: opts.item, tapSource: opts.tap });
}

function syncSlotGrid(buttons: readonly HTMLButtonElement[], opts: {
  readonly cache: string[]; readonly slots: InventorySnapshot["slots"];
  readonly offset: number; readonly tapKind: "chest" | "slot"; readonly tapSource: DragSource | null;
}): void {
  const tapIdx = opts.tapSource?.kind === opts.tapKind ? opts.tapSource.index : -1;
  for (let i = 0; i < buttons.length; i++) {
    syncSingleCell(buttons[i], {
      cache: opts.cache, index: i,
      item: opts.slots[opts.offset + i] ?? null,
      tap: tapIdx === opts.offset + i,
    });
  }
}

function buildChestHeader(opts: { readonly onTakeAll: () => void; readonly onClose: () => void }): {
  readonly header: HTMLDivElement; readonly titleEl: HTMLSpanElement; readonly noticeEl: HTMLSpanElement;
} {
  const header = domNode(TAG_DIV, "ow-modal-head");
  const left = domNode(TAG_DIV);
  left.style.display = "flex"; left.style.alignItems = "center"; left.style.gap = "8px";
  const titleEl = domNode("span");
  titleEl.textContent = "Chest";
  const noticeEl = domNode("span", "ow-buff-pill ow-buff-burn");
  noticeEl.hidden = true;
  left.append(titleEl, noticeEl);
  const right = domNode(TAG_DIV);
  right.style.display = "flex"; right.style.gap = "6px";
  const takeBtn = domNode(TAG_BTN, "ow-pill");
  takeBtn.type = TAG_BTN; takeBtn.textContent = "Take All"; takeBtn.addEventListener("click", opts.onTakeAll);
  const closeBtn = domNode(TAG_BTN, "ow-pill");
  closeBtn.type = TAG_BTN; closeBtn.textContent = "Close"; closeBtn.addEventListener("click", opts.onClose);
  right.append(takeBtn, closeBtn);
  header.append(left, right);
  return { header, titleEl, noticeEl };
}
