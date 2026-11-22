/** Minimalist 36-slot backpack (slots 9..35) + 4 armor slots + stats modal (no duplicate hotbar). */
import { getItemDef } from "@dc2d/content";
import {
  ARMOR_SLOT_KEYS, BACKPACK_SLOT_COUNT, HOTBAR_SLOT_COUNT, computeArmorDefense,
  type ArmorSlotKey, type InventorySnapshot,
} from "@dc2d/engine";
import type { DragSource, SlotDragManager } from "./slotDragManager.js";
import { armorLabel, domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

const TAG_DIV = "div";
const TAG_BTN = "button";
const CLS_SLOT = "ow-slot ow-bag-slot";

function buildInventoryFingerprint(inv: InventorySnapshot, heldId: string, tapSource: DragSource | null): string {
  const armorFp = ARMOR_SLOT_KEYS.map((k) => inv.armor[k] ?? "-").join(",");
  const bagFp = slotsFingerprint(inv.slots, HOTBAR_SLOT_COUNT, BACKPACK_SLOT_COUNT);
  return `${armorFp}#${bagFp}#${heldId}#${tapSourceFingerprint(tapSource)}`;
}

function tapSourceFingerprint(tap: DragSource | null): string {
  if (!tap) return "none";
  return tap.kind === "armor" ? tap.armorSlot : String(tap.index);
}

export class InventoryModal {
  readonly el: HTMLElement;
  private readonly armorButtons = new Map<ArmorSlotKey, HTMLButtonElement>();
  private readonly bagButtons: HTMLButtonElement[] = [];
  private readonly armorItemKeys = new Map<ArmorSlotKey, string>();
  private readonly bagItemKeys: string[] = Array.from({ length: BACKPACK_SLOT_COUNT }, () => "");
  private readonly statsEl: HTMLDivElement;
  private lastFingerprint = "";

  constructor(host: HTMLElement, drag: SlotDragManager, onClose: () => void) {
    this.el = domNode("section", "ow-modal ow-inv-modal");
    this.el.hidden = true;
    this.el.append(buildModalHeader(onClose));
    const body = domNode(TAG_DIV, "ow-inv-body");
    const leftCol = domNode(TAG_DIV, "ow-armor-wrap");
    leftCol.append(this.buildArmorGrid(drag));
    this.statsEl = domNode(TAG_DIV, "ow-stats-box");
    leftCol.append(this.statsEl);
    body.append(leftCol, this.buildBackpackGrid(drag));
    this.el.append(body);
    host.append(this.el);
  }

  private buildArmorGrid(drag: SlotDragManager): HTMLDivElement {
    const grid = domNode(TAG_DIV, "ow-armor-grid");
    for (const key of ARMOR_SLOT_KEYS) {
      const btn = domNode(TAG_BTN, CLS_SLOT);
      btn.type = TAG_BTN;
      btn.setAttribute("aria-label", `${armorLabel(key)} armor slot`);
      drag.bindSlot(btn, { kind: "armor", armorSlot: key });
      this.armorButtons.set(key, btn);
      grid.append(btn);
    }
    return grid;
  }

  private buildBackpackGrid(drag: SlotDragManager): HTMLDivElement {
    const grid = domNode(TAG_DIV, "ow-backpack-grid");
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) {
      const slotIndex = HOTBAR_SLOT_COUNT + i;
      const btn = domNode(TAG_BTN, CLS_SLOT);
      btn.type = TAG_BTN;
      btn.setAttribute("aria-label", `Backpack slot ${i + 1}`);
      drag.bindSlot(btn, { kind: "slot", index: slotIndex });
      this.bagButtons.push(btn);
      grid.append(btn);
    }
    return grid;
  }

  sync(inv: InventorySnapshot, opts: { readonly open: boolean; readonly tapSource: DragSource | null }): void {
    this.el.hidden = !opts.open;
    if (opts.open) this.syncOpenModal(inv, opts.tapSource);
  }

  private syncOpenModal(inv: InventorySnapshot, tapSource: DragSource | null): void {
    const heldId = inv.slots[inv.selectedHotbar]?.itemId ?? "-";
    const fp = buildInventoryFingerprint(inv, heldId, tapSource);
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;
    for (const key of ARMOR_SLOT_KEYS) this.syncSingleArmor(key, inv, tapSource);
    const tapIdx = tapSource?.kind === "slot" ? tapSource.index : -1;
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) this.syncSingleBagSlot(i, inv, tapIdx);
    this.syncStats(inv, heldId);
  }

  private syncSingleArmor(key: ArmorSlotKey, inv: InventorySnapshot, tapSource: DragSource | null): void {
    const btn = this.armorButtons.get(key);
    if (!btn) return;
    const itemId = inv.armor[key];
    const itemKey = itemId ?? "-";
    const tap = tapSource?.kind === "armor" && tapSource.armorSlot === key;
    if (this.armorItemKeys.get(key) === itemKey) {
      btn.dataset.tapSource = String(tap);
      return;
    }
    this.armorItemKeys.set(key, itemKey);
    renderSlotContent(btn, { item: itemId ? { itemId, count: 1 } : null, emptyHint: armorLabel(key), tapSource: tap });
  }

  private syncSingleBagSlot(bagIdx: number, inv: InventorySnapshot, tapIdx: number): void {
    const btn = this.bagButtons[bagIdx];
    if (!btn) return;
    const slotIndex = HOTBAR_SLOT_COUNT + bagIdx;
    const item = inv.slots[slotIndex] ?? null;
    const itemKey = item ? `${item.itemId}:${item.count}` : "-";
    const tap = tapIdx === slotIndex;
    if (this.bagItemKeys[bagIdx] === itemKey) {
      btn.dataset.tapSource = String(tap);
      return;
    }
    this.bagItemKeys[bagIdx] = itemKey;
    renderSlotContent(btn, { item, tapSource: tap });
  }

  private syncStats(inv: InventorySnapshot, heldId: string): void {
    const defense = computeArmorDefense(inv.armor, getItemDef);
    const heldName = heldId === "-" ? "Unarmed" : (getItemDef(heldId)?.name ?? heldId);
    const rows = [`HP: 100 / 100`, `Stamina: 100`, `Defense: ${defense}`, `Held: ${heldName}`];
    this.statsEl.replaceChildren(...rows.map((text) => {
      const line = domNode(TAG_DIV);
      line.textContent = text;
      return line;
    }));
  }
}

function buildModalHeader(onClose: () => void): HTMLDivElement {
  const head = domNode(TAG_DIV, "ow-modal-head");
  const title = domNode("span");
  title.textContent = "Inventory";
  const closeBtn = domNode(TAG_BTN, "ow-pill");
  closeBtn.type = TAG_BTN;
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", onClose);
  head.append(title, closeBtn);
  return head;
}
