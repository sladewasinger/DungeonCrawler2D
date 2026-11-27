/** Always-visible bottom hotbar (slots 1..9 plus permanent Map [M] and Lantern [F] buttons). */
import { HOTBAR_SLOT_COUNT, type InventorySlot, type InventorySnapshot } from "@dc2d/engine";
import { parseStaticSvg } from "../dom/staticSvg.js";
import { makeMapUiIconUrl } from "../icons/itemIcons.js";
import type { SlotDragManager } from "./inventory/slotDragManager.js";
import { domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

const TAG_BTN = "button";
const ATTR_ARIA_LABEL = "aria-label";

export interface HotbarActionCallbacks {
  readonly onToggleTorch: () => void;
  readonly onToggleMap: () => void;
}

function slotItemKey(item: InventorySlot): string {
  return item ? `${item.itemId}:${item.count}:${item.prefixId ?? ""}` : "-";
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

function bindHotbarActionButton(btn: HTMLButtonElement, onTrigger: () => void): void {
  let lastTouchMs = -1000;
  btn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    lastTouchMs = performance.now();
    onTrigger();
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (performance.now() - lastTouchMs >= 400) onTrigger();
  });
}

function buildMapHotbarButton(onToggleMap: () => void): HTMLButtonElement {
  const btn = domNode(TAG_BTN, "ow-slot ow-map-btn");
  btn.type = TAG_BTN;
  btn.title = "Overworld Map (M)";
  btn.setAttribute(ATTR_ARIA_LABEL, "Toggle Overworld Map (M)");
  const key = domNode("span", "ow-slot-key");
  key.textContent = "M";
  const img = document.createElement("img");
  img.className = "ow-slot-img";
  img.src = makeMapUiIconUrl();
  img.alt = "Overworld Map";
  img.draggable = false;
  btn.append(key, img);
  bindHotbarActionButton(btn, onToggleMap);
  return btn;
}

function buildLanternHotbarButton(onToggleTorch: () => void): HTMLButtonElement {
  const btn = domNode(TAG_BTN, "ow-slot ow-lantern-btn");
  btn.type = TAG_BTN;
  btn.title = "Toggle Lantern (F)";
  btn.setAttribute(ATTR_ARIA_LABEL, "Toggle lantern (F)");
  const key = domNode("span", "ow-slot-key");
  key.textContent = "F";
  btn.append(key, parseStaticSvg(createLanternIconSvg()));
  bindHotbarActionButton(btn, onToggleTorch);
  return btn;
}

export class BottomHotbar {
  readonly el: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly mapBtn: HTMLButtonElement;
  private readonly lanternBtn: HTMLButtonElement;
  private readonly slotItemKeys: string[] = Array.from({ length: HOTBAR_SLOT_COUNT }, () => "");
  private lastFingerprint = "";
  private lastTorchLit: boolean | null = null;
  private lastMapOpen: boolean | null = null;

  constructor(host: HTMLElement, drag: SlotDragManager, callbacks: HotbarActionCallbacks) {
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
    this.mapBtn = buildMapHotbarButton(callbacks.onToggleMap);
    this.lanternBtn = buildLanternHotbarButton(callbacks.onToggleTorch);
    this.el.append(this.mapBtn, this.lanternBtn);
    host.append(this.el);
  }

  sync(inv: InventorySnapshot, opts: { readonly torchLit?: boolean; readonly mapOpen?: boolean } = {}): void {
    this.syncActionButtons(opts);
    const fp = `${slotsFingerprint(inv.slots, 0, HOTBAR_SLOT_COUNT)}#${inv.selectedHotbar}`;
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) this.syncSlot(i, inv);
  }

  private syncActionButtons(opts: { readonly torchLit?: boolean; readonly mapOpen?: boolean }): void {
    const torchLit = opts.torchLit ?? true;
    const mapOpen = opts.mapOpen ?? false;
    if (this.lastTorchLit !== torchLit) {
      this.lastTorchLit = torchLit;
      this.lanternBtn.dataset.lit = String(torchLit);
      this.lanternBtn.style.color = torchLit ? "#fde047" : "#64748b";
    }
    if (this.lastMapOpen !== mapOpen) {
      this.lastMapOpen = mapOpen;
      this.mapBtn.dataset.active = String(mapOpen);
    }
  }

  private syncSlot(index: number, inv: InventorySnapshot): void {
    const btn = this.buttons[index];
    if (!btn) return;
    const item = inv.slots[index] ?? null;
    const itemKey = slotItemKey(item);
    const selected = inv.selectedHotbar === index;
    if (this.slotItemKeys[index] === itemKey) {
      btn.dataset.selected = String(selected);
      return;
    }
    this.slotItemKeys[index] = itemKey;
    renderSlotContent(btn, { item, keyLabel: String(index + 1), selected });
  }
}
