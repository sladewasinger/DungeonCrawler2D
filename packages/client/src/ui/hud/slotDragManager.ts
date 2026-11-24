/** Unified pointer drag-and-drop, outside-HUD dropping, and Shift-click chest transfer. */
import { getItemDef, maxStackForItem } from "@dc2d/content";
import { HOTBAR_SLOT_COUNT, type ArmorSlotKey, type InventorySlot, type InventorySnapshot, type SlotItem } from "@dc2d/engine";
import { getItemIconUrl } from "../icons/itemIcons.js";
import {
  isSameDragSource, resolvePointerDrop, type DragSource, type HudDropZone, type MeasuredSlot, type MeasuredZone,
} from "./drag/slotDropResolver.js";
import { domNode, type HudActions } from "./slotRenderer.js";

export type { DragSource } from "./drag/slotDropResolver.js";

interface PointerTracker {
  readonly source: DragSource; readonly startX: number; readonly startY: number; readonly itemId: string; dragging: boolean;
}

const DRAG_THRESHOLD_PX = 6;
const KIND_CHEST = "chest" as const;
const KIND_INV = "inv" as const;
const KIND_ARMOR = "armor" as const;
const KIND_SLOT = "slot" as const;
const SLOT_SELECTOR = "[data-slot-index], [data-armor-slot], [data-chest-slot]";
const ZONE_SELECTOR = ".ow-modal:not([hidden]), [data-drop-zone]";

export class SlotDragManager {
  private tracker: PointerTracker | null = null;
  private ghost: HTMLImageElement | null = null;
  private latestInv: InventorySnapshot | null = null;
  private chestSlots: readonly InventorySlot[] | null = null;
  private lastPointer: { readonly x: number; readonly y: number } | null = null;

  constructor(private readonly actions: HudActions) {
    window.addEventListener("pointermove", (e) => this.handleMove(e));
    window.addEventListener("pointerup", (e) => this.handleUp(e));
    window.addEventListener("pointercancel", () => this.cancelDrag());
  }

  setState(inv: InventorySnapshot, opts: { readonly panelOpen: boolean; readonly chestSlots?: readonly InventorySlot[] | null }): void {
    this.latestInv = inv;
    this.chestSlots = opts.chestSlots ?? null;
  }

  activeTapSource(): DragSource | null { return null; }
  clearTapSelection(): void { /* Tap-to-select removed; drag-and-drop or Shift-click only. */ }

  hoveredFilledSource(): DragSource | null {
    if (!this.lastPointer) return null;
    const slotEl = document.elementFromPoint(this.lastPointer.x, this.lastPointer.y)?.closest<HTMLElement>(SLOT_SELECTOR);
    const src = slotEl ? sourceFromEl(slotEl) : null;
    return src && this.itemIdFor(src) ? src : null;
  }

  bindSlot(btn: HTMLButtonElement, source: DragSource): void {
    if (source.kind === KIND_SLOT) btn.dataset.slotIndex = String(source.index);
    else if (source.kind === KIND_CHEST) btn.dataset.chestSlot = String(source.index);
    else btn.dataset.armorSlot = source.armorSlot;
    btn.addEventListener("pointerdown", (e) => this.startPointer(e, source));
  }

  private slotItemFor(source: DragSource): SlotItem | null {
    if (source.kind === KIND_CHEST) return this.chestSlots?.[source.index] ?? null;
    if (!this.latestInv) return null;
    if (source.kind === KIND_SLOT) return this.latestInv.slots[source.index] ?? null;
    const id = this.latestInv.armor[source.armorSlot];
    return id ? { itemId: id, count: 1 } : null;
  }

  private itemIdFor(source: DragSource): string | null {
    return this.slotItemFor(source)?.itemId ?? null;
  }

  private tryQuickChestTransfer(e: PointerEvent, source: DragSource, itemId: string | null): boolean {
    if (!e.shiftKey || !this.chestSlots || !itemId || source.kind === KIND_ARMOR) return false;
    e.preventDefault();
    const fromChest = source.kind === KIND_CHEST;
    this.actions.onChestTransfer({
      from: fromChest ? KIND_CHEST : KIND_INV, fromSlot: source.index,
      to: fromChest ? KIND_INV : KIND_CHEST, toSlot: 0, quick: true,
    });
    return true;
  }

  private startPointer(e: PointerEvent, source: DragSource): void {
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const itemId = this.itemIdFor(source);
    if (this.tryQuickChestTransfer(e, source, itemId)) return;
    const isHotbar = source.kind === KIND_SLOT && source.index < HOTBAR_SLOT_COUNT;
    if (!itemId && !isHotbar) return;
    e.preventDefault();
    this.tracker = { source, startX: e.clientX, startY: e.clientY, itemId: itemId ?? "", dragging: false };
  }

  private handleMove(e: PointerEvent): void {
    this.lastPointer = { x: e.clientX, y: e.clientY };
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
      this.resolveAndDispatchDrop(e.clientX, e.clientY, tracker);
      return;
    }
    if (tracker.source.kind === KIND_SLOT && tracker.source.index < HOTBAR_SLOT_COUNT) {
      this.actions.onSelectHotbar(tracker.source.index);
    }
  }

  private resolveAndDispatchDrop(x: number, y: number, tracker: PointerTracker): void {
    const res = resolvePointerDrop({
      x, y, from: tracker.source, itemId: tracker.itemId, maxStack: maxStackForItem(tracker.itemId),
      itemArmorSlot: getItemDef(tracker.itemId)?.armorSlot,
      zones: measureHudZones(),
      slots: this.measureHudSlots(),
    });
    if (res.kind === "worldDrop") this.dispatchWorldDrop(tracker.source);
    else if (res.kind === "transfer") this.dispatchTransfer(tracker.source, res.target);
  }

  private measureHudSlots(): MeasuredSlot[] {
    const out: MeasuredSlot[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      if (el.closest("[hidden]")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const source = sourceFromEl(el);
      if (!source) continue;
      const zone = (el.closest<HTMLElement>("[data-drop-zone]")?.dataset.dropZone ?? "backpack") as HudDropZone;
      out.push({ source, zone, rect, item: this.slotItemFor(source) });
    }
    return out;
  }

  private dispatchWorldDrop(from: DragSource): void {
    if (from.kind === KIND_SLOT) this.actions.onDropItem({ source: KIND_INV, slotIndex: from.index });
    else if (from.kind === KIND_ARMOR) this.actions.onDropItem({ source: KIND_ARMOR, armorSlot: from.armorSlot });
    else this.actions.onDropItem({ source: KIND_CHEST, slotIndex: from.index });
  }

  private dispatchTransfer(from: DragSource, to: DragSource): void {
    if (isSameDragSource(from, to)) return;
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

function measureHudZones(): MeasuredZone[] {
  const out: MeasuredZone[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(ZONE_SELECTOR)) {
    if (el.closest("[hidden]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const zone = (el.dataset.dropZone ?? "modal") as MeasuredZone["zone"];
    out.push({ zone, rect });
  }
  return out;
}

function dispatchChestTransfer(from: DragSource, to: DragSource, actions: HudActions): boolean {
  if (from.kind === KIND_ARMOR || to.kind === KIND_ARMOR) return false;
  if (from.kind !== KIND_CHEST && to.kind !== KIND_CHEST) return false;
  actions.onChestTransfer({
    from: from.kind === KIND_CHEST ? KIND_CHEST : KIND_INV, fromSlot: from.index,
    to: to.kind === KIND_CHEST ? KIND_CHEST : KIND_INV, toSlot: to.index,
  });
  return true;
}

function dispatchInvArmorTransfer(from: DragSource, to: DragSource, actions: HudActions): void {
  if (from.kind === KIND_ARMOR) {
    if (to.kind === KIND_SLOT) actions.onUnequipArmor({ armorSlot: from.armorSlot, targetSlot: to.index });
    return;
  }
  if (from.kind !== KIND_SLOT) return;
  if (to.kind === KIND_SLOT) actions.onMoveSlot({ from: from.index, to: to.index });
  else if (to.kind === KIND_ARMOR) actions.onEquipArmor({ slotIndex: from.index, targetArmor: to.armorSlot });
}

function parseIndexedSource(raw: string | undefined, kind: "chest" | "slot"): DragSource | null {
  if (raw === undefined) return null;
  const index = Number(raw);
  return Number.isInteger(index) ? { kind, index } : null;
}

function sourceFromEl(slotEl: HTMLElement): DragSource | null {
  const indexed = parseIndexedSource(slotEl.dataset.chestSlot, KIND_CHEST)
    ?? parseIndexedSource(slotEl.dataset.slotIndex, KIND_SLOT);
  if (indexed) return indexed;
  const armorSlot = slotEl.dataset.armorSlot as ArmorSlotKey | undefined;
  return armorSlot ? { kind: KIND_ARMOR, armorSlot } : null;
}
