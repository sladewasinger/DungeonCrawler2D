/** Unified pointer drag-and-drop and 2-tap transfer across Hotbar, Backpack, and Armor. */
import { HOTBAR_SLOT_COUNT, type ArmorSlotKey, type InventorySnapshot } from "@dc2d/engine";
import { getItemIconUrl } from "../icons/itemIcons.js";
import { domNode, type HudActions } from "./slotRenderer.js";

export type DragSource =
  | { readonly kind: "slot"; readonly index: number }
  | { readonly kind: "armor"; readonly armorSlot: ArmorSlotKey };

interface PointerTracker {
  readonly source: DragSource;
  readonly startX: number;
  readonly startY: number;
  readonly itemId: string;
  dragging: boolean;
}

const DRAG_THRESHOLD_PX = 6;

export class SlotDragManager {
  private tracker: PointerTracker | null = null;
  private ghost: HTMLImageElement | null = null;
  private tapSource: DragSource | null = null;
  private latestInv: InventorySnapshot | null = null;
  private inventoryOpen = false;

  constructor(private readonly actions: HudActions, private readonly onSelectionChange: () => void) {
    window.addEventListener("pointermove", (e) => this.handleMove(e));
    window.addEventListener("pointerup", (e) => this.handleUp(e));
    window.addEventListener("pointercancel", () => this.cancelDrag());
  }

  setState(inv: InventorySnapshot, inventoryOpen: boolean): void {
    this.latestInv = inv;
    this.inventoryOpen = inventoryOpen;
    if (!inventoryOpen && this.tapSource) this.clearTapSelection();
  }

  activeTapSource(): DragSource | null { return this.tapSource; }

  clearTapSelection(): void {
    if (!this.tapSource) return;
    this.tapSource = null;
    this.onSelectionChange();
  }

  bindSlot(btn: HTMLButtonElement, source: DragSource): void {
    if (source.kind === "slot") btn.dataset.slotIndex = String(source.index);
    else btn.dataset.armorSlot = source.armorSlot;
    btn.addEventListener("pointerdown", (e) => this.startPointer(e, source));
  }

  private itemIdFor(source: DragSource): string | null {
    if (!this.latestInv) return null;
    return source.kind === "slot" ? (this.latestInv.slots[source.index]?.itemId ?? null) : this.latestInv.armor[source.armorSlot];
  }

  private startPointer(e: PointerEvent, source: DragSource): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const itemId = this.itemIdFor(source);
    if (!itemId && !this.tapSource && !(source.kind === "slot" && source.index < HOTBAR_SLOT_COUNT)) return;
    e.preventDefault();
    this.tracker = { source, startX: e.clientX, startY: e.clientY, itemId: itemId ?? "", dragging: false };
  }

  private handleMove(e: PointerEvent): void {
    if (!this.tracker || !this.tracker.itemId) return;
    const dist = Math.hypot(e.clientX - this.tracker.startX, e.clientY - this.tracker.startY);
    if (!this.tracker.dragging && dist > DRAG_THRESHOLD_PX) {
      this.tracker.dragging = true;
      this.spawnGhost(this.tracker.itemId, e.clientX, e.clientY);
    }
    if (this.ghost) {
      this.ghost.style.left = `${e.clientX}px`;
      this.ghost.style.top = `${e.clientY}px`;
    }
  }

  private handleUp(e: PointerEvent): void {
    const tracker = this.tracker;
    if (!tracker) return;
    this.cancelDrag();
    if (tracker.dragging) {
      const target = findDropTarget(e.clientX, e.clientY);
      if (target) this.dispatchTransfer(tracker.source, target);
      return;
    }
    this.handleTap(tracker.source);
  }

  private handleTap(source: DragSource): void {
    const isHotbar = source.kind === "slot" && source.index < HOTBAR_SLOT_COUNT;
    if (isHotbar) this.actions.onSelectHotbar(source.index);
    if (!this.inventoryOpen) return;
    if (this.tapSource && !sameSource(this.tapSource, source)) {
      this.dispatchTransfer(this.tapSource, source);
      this.clearTapSelection();
      return;
    }
    this.toggleTapSource(source);
  }

  private toggleTapSource(source: DragSource): void {
    const same = Boolean(this.tapSource && sameSource(this.tapSource, source));
    this.tapSource = same || !this.itemIdFor(source) ? null : source;
    this.onSelectionChange();
  }

  private dispatchTransfer(from: DragSource, to: DragSource): void {
    if (sameSource(from, to)) return;
    if (from.kind === "slot" && to.kind === "slot") this.actions.onMoveSlot({ from: from.index, to: to.index });
    else if (from.kind === "slot" && to.kind === "armor") this.actions.onEquipArmor({ slotIndex: from.index, targetArmor: to.armorSlot });
    else if (from.kind === "armor" && to.kind === "slot") this.actions.onUnequipArmor({ armorSlot: from.armorSlot, targetSlot: to.index });
  }

  private spawnGhost(itemId: string, x: number, y: number): void {
    const img = domNode("img", "ow-drag-ghost");
    img.src = getItemIconUrl(itemId);
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    document.body.append(img);
    this.ghost = img;
  }

  private cancelDrag(): void {
    this.tracker = null;
    this.ghost?.remove();
    this.ghost = null;
  }
}

function sameSource(a: DragSource, b: DragSource): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "slot" && b.kind === "slot" ? a.index === b.index : a.kind === "armor" && b.kind === "armor" && a.armorSlot === b.armorSlot;
}

function findDropTarget(x: number, y: number): DragSource | null {
  const el = document.elementFromPoint(x, y);
  const slotEl = el?.closest<HTMLElement>("[data-slot-index], [data-armor-slot]");
  if (!slotEl) return null;
  if (slotEl.dataset.slotIndex !== undefined) {
    const idx = Number(slotEl.dataset.slotIndex);
    return Number.isInteger(idx) ? { kind: "slot", index: idx } : null;
  }
  const armorSlot = slotEl.dataset.armorSlot as ArmorSlotKey | undefined;
  return armorSlot ? { kind: "armor", armorSlot } : null;
}
