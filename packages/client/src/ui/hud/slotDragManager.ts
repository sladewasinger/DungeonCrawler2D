/** Unified pointer drag-and-drop, Shift-click chest transfer, and 2-tap transfer across Hotbar, Backpack, Armor, and Chests. */
import { HOTBAR_SLOT_COUNT, type ArmorSlotKey, type InventorySlot, type InventorySnapshot } from "@dc2d/engine";
import { getItemIconUrl } from "../icons/itemIcons.js";
import { domNode, type HudActions } from "./slotRenderer.js";

export type DragSource =
  | { readonly kind: "slot"; readonly index: number }
  | { readonly kind: "armor"; readonly armorSlot: ArmorSlotKey }
  | { readonly kind: "chest"; readonly index: number };

interface PointerTracker {
  readonly source: DragSource; readonly startX: number; readonly startY: number; readonly itemId: string; dragging: boolean;
}

const DRAG_THRESHOLD_PX = 6;
const KIND_CHEST = "chest" as const;
const KIND_INV = "inv" as const;

export class SlotDragManager {
  private tracker: PointerTracker | null = null;
  private ghost: HTMLImageElement | null = null;
  private tapSource: DragSource | null = null;
  private latestInv: InventorySnapshot | null = null;
  private chestSlots: readonly InventorySlot[] | null = null;
  private panelOpen = false;

  constructor(private readonly actions: HudActions, private readonly onSelectionChange: () => void) {
    window.addEventListener("pointermove", (e) => this.handleMove(e));
    window.addEventListener("pointerup", (e) => this.handleUp(e));
    window.addEventListener("pointercancel", () => this.cancelDrag());
  }

  setState(inv: InventorySnapshot, opts: { readonly panelOpen: boolean; readonly chestSlots?: readonly InventorySlot[] | null }): void {
    this.latestInv = inv;
    this.panelOpen = opts.panelOpen;
    this.chestSlots = opts.chestSlots ?? null;
    if (!opts.panelOpen && this.tapSource) this.clearTapSelection();
  }

  activeTapSource(): DragSource | null { return this.tapSource; }

  clearTapSelection(): void {
    if (!this.tapSource) return;
    this.tapSource = null;
    this.onSelectionChange();
  }

  bindSlot(btn: HTMLButtonElement, source: DragSource): void {
    if (source.kind === "slot") btn.dataset.slotIndex = String(source.index);
    else if (source.kind === KIND_CHEST) btn.dataset.chestSlot = String(source.index);
    else btn.dataset.armorSlot = source.armorSlot;
    btn.addEventListener("pointerdown", (e) => this.startPointer(e, source));
  }

  private itemIdFor(source: DragSource): string | null {
    if (source.kind === KIND_CHEST) return this.chestSlots?.[source.index]?.itemId ?? null;
    return this.latestInv ? readInventoryItemId(this.latestInv, source) : null;
  }

  private tryQuickChestTransfer(e: PointerEvent, source: DragSource, itemId: string | null): boolean {
    if (!e.shiftKey || !this.chestSlots || !itemId || source.kind === "armor") return false;
    e.preventDefault();
    const fromChest = source.kind === KIND_CHEST;
    this.actions.onChestTransfer({
      from: fromChest ? KIND_CHEST : KIND_INV, fromSlot: source.index,
      to: fromChest ? KIND_INV : KIND_CHEST, toSlot: 0, quick: true,
    });
    return true;
  }

  private startPointer(e: PointerEvent, source: DragSource): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const itemId = this.itemIdFor(source);
    if (this.tryQuickChestTransfer(e, source, itemId)) return;
    if (!canStartPointer(itemId, this.tapSource, source)) return;
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
    if (source.kind === "slot" && source.index < HOTBAR_SLOT_COUNT) this.actions.onSelectHotbar(source.index);
    if (!this.panelOpen) return;
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
    if (dispatchChestTransfer(from, to, this.actions)) return;
    dispatchInvArmorTransfer(from, to, this.actions);
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

function dispatchChestTransfer(from: DragSource, to: DragSource, actions: HudActions): boolean {
  if (from.kind === "armor" || to.kind === "armor") return false;
  if (from.kind !== KIND_CHEST && to.kind !== KIND_CHEST) return false;
  actions.onChestTransfer({
    from: from.kind === KIND_CHEST ? KIND_CHEST : KIND_INV, fromSlot: from.index,
    to: to.kind === KIND_CHEST ? KIND_CHEST : KIND_INV, toSlot: to.index,
  });
  return true;
}

function readInventoryItemId(inv: InventorySnapshot, source: DragSource): string | null {
  if (source.kind === "slot") return inv.slots[source.index]?.itemId ?? null;
  return source.kind === "armor" ? inv.armor[source.armorSlot] : null;
}

function canStartPointer(itemId: string | null, tapSource: DragSource | null, source: DragSource): boolean {
  if (itemId || tapSource) return true;
  return source.kind === "slot" && source.index < HOTBAR_SLOT_COUNT;
}

function dispatchInvArmorTransfer(from: DragSource, to: DragSource, actions: HudActions): void {
  if (from.kind === "armor") {
    if (to.kind === "slot") actions.onUnequipArmor({ armorSlot: from.armorSlot, targetSlot: to.index });
    return;
  }
  if (from.kind !== "slot") return;
  if (to.kind === "slot") actions.onMoveSlot({ from: from.index, to: to.index });
  else if (to.kind === "armor") actions.onEquipArmor({ slotIndex: from.index, targetArmor: to.armorSlot });
}

function sourceKey(s: DragSource): string {
  return s.kind === "armor" ? `a:${s.armorSlot}` : `${s.kind}:${s.index}`;
}

function sameSource(a: DragSource, b: DragSource): boolean {
  return sourceKey(a) === sourceKey(b);
}

function parseIndexedSource(raw: string | undefined, kind: "chest" | "slot"): DragSource | null {
  if (raw === undefined) return null;
  const index = Number(raw);
  return Number.isInteger(index) ? { kind, index } : null;
}

function findDropTarget(x: number, y: number): DragSource | null {
  const el = document.elementFromPoint(x, y);
  const slotEl = el?.closest<HTMLElement>("[data-slot-index], [data-armor-slot], [data-chest-slot]");
  if (!slotEl) return null;
  const indexed = parseIndexedSource(slotEl.dataset.chestSlot, KIND_CHEST)
    ?? parseIndexedSource(slotEl.dataset.slotIndex, "slot");
  if (indexed) return indexed;
  const armorSlot = slotEl.dataset.armorSlot as ArmorSlotKey | undefined;
  return armorSlot ? { kind: "armor", armorSlot } : null;
}
