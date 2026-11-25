/** Always-visible, larger 9-slot bottom hotbar (slots 0..8), droppable even when inventory is open. */
import { HOTBAR_SLOT_COUNT, type InventorySlot, type InventorySnapshot } from "@dc2d/engine";
import type { DragSource, SlotDragManager } from "./slotDragManager.js";
import { domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

const TAG_BTN = "button";
const ATTR_ARIA_LABEL = "aria-label";

function slotItemKey(item: InventorySlot): string {
  return item ? `${item.itemId}:${item.count}` : "-";
}

function createLanternIconSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" style="image-rendering:pixelated;pointer-events:none">
    <rect x="6" y="1" width="4" height="2" fill="#94a3b8"/>
    <rect x="4" y="3" width="8" height="2" fill="#b45309"/>
    <rect x="4" y="5" width="8" height="7" fill="#1e293b"/>
    <rect x="5" y="5" width="6" height="6" fill="currentColor"/>
    <rect x="4" y="12" width="8" height="2" fill="#78350f"/>
  </svg>`;
}

export class BottomHotbar {
  readonly el: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly lanternBtn: HTMLButtonElement;
  private readonly slotItemKeys: string[] = Array.from({ length: HOTBAR_SLOT_COUNT }, () => "");
  private lastFingerprint = "";
  private lastTorchLit: boolean | null = null;
  private lastTouchTorchMs = -1000;

  constructor(host: HTMLElement, drag: SlotDragManager, onToggleTorch: () => void) {
    this.el = domNode("div", "ow-hotbar");
    this.el.dataset.dropZone = "hotbar";
    this.el.setAttribute("role", "toolbar");
    this.el.setAttribute(ATTR_ARIA_LABEL, "Hotbar");
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const btn = domNode(TAG_BTN, "ow-slot");
      btn.type = TAG_BTN;
      btn.setAttribute(ATTR_ARIA_LABEL, `Hotbar slot ${i + 1}`);
      drag.bindSlot(btn, { kind: "slot", index: i });
      this.buttons.push(btn);
      this.el.append(btn);
    }
    this.lanternBtn = domNode(TAG_BTN, "ow-slot ow-lantern-btn");
    this.lanternBtn.type = TAG_BTN;
    this.lanternBtn.setAttribute(ATTR_ARIA_LABEL, "Toggle lantern (F)");
    this.lanternBtn.innerHTML = `<span class="ow-slot-key">F</span>${createLanternIconSvg()}`;
    this.lanternBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.pointerType !== "touch") return;
      e.preventDefault();
      this.lastTouchTorchMs = performance.now();
      onToggleTorch();
    });
    this.lanternBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (performance.now() - this.lastTouchTorchMs >= 400) onToggleTorch();
    });
    this.el.append(this.lanternBtn);
    host.append(this.el);
  }

  sync(inv: InventorySnapshot, tapSource: DragSource | null, torchLit = true): void {
    if (this.lastTorchLit !== torchLit) {
      this.lastTorchLit = torchLit;
      this.lanternBtn.dataset.lit = String(torchLit);
      this.lanternBtn.style.color = torchLit ? "#fde047" : "#64748b";
    }
    const tapIdx = tapSource?.kind === "slot" ? tapSource.index : -1;
    const fp = `${slotsFingerprint(inv.slots, 0, HOTBAR_SLOT_COUNT)}#${inv.selectedHotbar}#${tapIdx}`;
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) this.syncSlot(i, inv, tapIdx);
  }

  private syncSlot(index: number, inv: InventorySnapshot, tapIdx: number): void {
    const btn = this.buttons[index];
    if (!btn) return;
    const item = inv.slots[index] ?? null;
    const itemKey = slotItemKey(item);
    const selected = inv.selectedHotbar === index;
    const tap = tapIdx === index;
    if (this.slotItemKeys[index] === itemKey) {
      btn.dataset.selected = String(selected);
      btn.dataset.tapSource = String(tap);
      return;
    }
    this.slotItemKeys[index] = itemKey;
    renderSlotContent(btn, { item, keyLabel: String(index + 1), selected, tapSource: tap });
  }
}
