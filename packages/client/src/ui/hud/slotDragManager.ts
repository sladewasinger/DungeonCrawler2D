/** Unified pointer drag-and-drop, right/Shift-click chest transfer, hover preview, and panel inspection. */
import { getItemDef, maxStackForItem } from "@dc2d/content";
import { HOTBAR_SLOT_COUNT, type ArmorSlotKey, type InventorySlot, type InventorySnapshot, type SlotItem } from "@dc2d/engine";
import { getItemIconUrl } from "../icons/itemIcons.js";
import {
  dragSourceKey, isSameDragSource, resolvePointerDrop, type DragSource, type HudDropZone, type MeasuredSlot, type MeasuredZone,
} from "./drag/slotDropResolver.js";
import { domNode, type HudActions } from "./slotRenderer.js";

export type { DragSource } from "./drag/slotDropResolver.js";

interface PointerTracker {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly source: DragSource;
  readonly startX: number;
  readonly startY: number;
  readonly itemId: string;
  dragging: boolean;
}

const DRAG_THRESHOLD_PX = 6;
const TOUCH_DRAG_THRESHOLD_PX = 14;
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
  private panelOpen = false;
  private lastPointer: { readonly x: number; readonly y: number } | null = null;
  private lastHoverKey = "";

  constructor(private readonly actions: HudActions) {
    window.addEventListener("pointermove", (e) => this.handleMove(e));
    window.addEventListener("pointerup", (e) => this.handleUp(e));
    window.addEventListener("pointercancel", (e) => { if (this.tracker && e.pointerId === this.tracker.pointerId) this.cancelDrag(); });
  }

  setState(inv: InventorySnapshot, opts: { readonly panelOpen: boolean; readonly chestSlots?: readonly InventorySlot[] | null }): void {
    this.latestInv = inv;
    this.panelOpen = opts.panelOpen;
    this.chestSlots = opts.chestSlots ?? null;
  }

  activeTapSource(): DragSource | null { return null; }
  clearTapSelection(): void { this.emitHover(null); }

  hoveredFilledSource(): DragSource | null {
    if (!this.lastPointer) return null;
    const hit = hoveredSlotElAt(this.lastPointer.x, this.lastPointer.y);
    return hit && this.itemIdFor(hit.source) ? hit.source : null;
  }

  bindSlot(btn: HTMLButtonElement, source: DragSource): void {
    if (source.kind === KIND_SLOT) btn.dataset.slotIndex = String(source.index);
    else if (source.kind === KIND_CHEST) btn.dataset.chestSlot = String(source.index);
    else btn.dataset.armorSlot = source.armorSlot;
    btn.addEventListener("pointerdown", (e) => this.startPointer(e, source));
    btn.addEventListener("contextmenu", (e) => { if (this.chestSlots) e.preventDefault(); });
  }

  private armorSlotItem(slot: ArmorSlotKey): SlotItem | null {
    const id = this.latestInv?.armor[slot];
    if (!id) return null;
    const prefixId = this.latestInv?.armorPrefixes?.[slot];
    return prefixId ? { itemId: id, count: 1, prefixId } : { itemId: id, count: 1 };
  }

  private slotItemFor(source: DragSource): SlotItem | null {
    if (source.kind === KIND_CHEST) return this.chestSlots?.[source.index] ?? null;
    if (source.kind === KIND_SLOT) return this.latestInv?.slots[source.index] ?? null;
    return this.armorSlotItem(source.armorSlot);
  }

  private itemIdFor(source: DragSource): string | null { return this.slotItemFor(source)?.itemId ?? null; }

  private dispatchQuickChest(source: DragSource): void {
    if (source.kind === KIND_ARMOR) return;
    const fromChest = source.kind === KIND_CHEST;
    this.actions.onChestTransfer({
      from: fromChest ? KIND_CHEST : KIND_INV, fromSlot: source.index,
      to: fromChest ? KIND_INV : KIND_CHEST, toSlot: 0, quick: true,
    });
  }

  private tryQuickChestTransfer(e: PointerEvent, source: DragSource, itemId: string | null): boolean {
    if (!this.chestSlots || !itemId || source.kind === KIND_ARMOR) return false;
    const isRightClick = e.pointerType === "mouse" && e.button === 2;
    if (!e.shiftKey && !isRightClick) return false;
    e.preventDefault();
    this.dispatchQuickChest(source);
    return true;
  }

  private isBusyOrWrongButton(e: PointerEvent, source: DragSource, itemId: string | null): boolean {
    if (this.tracker || (e.pointerType === "mouse" && e.button !== 0)) return true;
    return !itemId && !(source.kind === KIND_SLOT && source.index < HOTBAR_SLOT_COUNT);
  }

  private startPointer(e: PointerEvent, source: DragSource): void {
    e.stopPropagation();
    this.emitHover(null);
    if (e.pointerType === "mouse") this.lastPointer = { x: e.clientX, y: e.clientY };
    const itemId = this.itemIdFor(source);
    if (this.tryQuickChestTransfer(e, source, itemId) || this.isBusyOrWrongButton(e, source, itemId)) return;
    e.preventDefault();
    this.tracker = { pointerId: e.pointerId, pointerType: e.pointerType, source, startX: e.clientX, startY: e.clientY, itemId: itemId ?? "", dragging: false };
  }

  private emitHover(hit: { readonly source: DragSource; readonly rect: DOMRect } | null): void {
    const key = hit ? dragSourceKey(hit.source) : "";
    if (key === this.lastHoverKey) return;
    this.lastHoverKey = key;
    this.actions.onHoverItem?.(hit?.source ?? null, hit?.rect);
  }

  private updateMouseHover(e: PointerEvent): void {
    if (e.pointerType !== "mouse" || this.tracker) return;
    const hit = hoveredSlotElAt(e.clientX, e.clientY);
    if (!hit || !this.itemIdFor(hit.source)) { this.emitHover(null); return; }
    this.emitHover({ source: hit.source, rect: hit.el.getBoundingClientRect() });
  }

  private advanceActiveDrag(tracker: PointerTracker, x: number, y: number): void {
    const threshold = tracker.pointerType === "touch" ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;
    if (!tracker.dragging && Math.hypot(x - tracker.startX, y - tracker.startY) > threshold) {
      tracker.dragging = true;
      this.actions.onDismissInspect?.();
      this.spawnGhost(tracker.itemId, x, y);
    }
    if (this.ghost) { this.ghost.style.left = `${x}px`; this.ghost.style.top = `${y}px`; }
  }

  private handleMove(e: PointerEvent): void {
    if (e.pointerType === "mouse") this.lastPointer = { x: e.clientX, y: e.clientY };
    if (this.tracker && e.pointerId === this.tracker.pointerId && this.tracker.itemId) {
      this.advanceActiveDrag(this.tracker, e.clientX, e.clientY);
      return;
    }
    this.updateMouseHover(e);
  }

  private handleTapUp(tracker: PointerTracker): void {
    if (tracker.source.kind === KIND_SLOT && tracker.source.index < HOTBAR_SLOT_COUNT) {
      this.actions.onSelectHotbar(tracker.source.index);
    }
    if (this.panelOpen && tracker.itemId) this.actions.onInspectItem?.(tracker.source, rectForSource(tracker.source));
    else this.actions.onDismissInspect?.();
  }

  private handleUp(e: PointerEvent): void {
    const tracker = this.tracker;
    if (!tracker || e.pointerId !== tracker.pointerId) return;
    this.cancelDrag();
    if (tracker.dragging) this.resolveAndDispatchDrop(e.clientX, e.clientY, tracker);
    else this.handleTapUp(tracker);
  }

  private resolveAndDispatchDrop(x: number, y: number, tracker: PointerTracker): void {
    const prefixId = this.slotItemFor(tracker.source)?.prefixId;
    const res = resolvePointerDrop({
      x, y, from: tracker.source, itemId: tracker.itemId, maxStack: maxStackForItem(tracker.itemId),
      ...(prefixId ? { prefixId } : {}),
      itemArmorSlot: getItemDef(tracker.itemId)?.armorSlot,
      zones: measureHudZones(), slots: this.measureHudSlots(),
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
    img.style.left = `${x}px`; img.style.top = `${y}px`;
    document.body.append(img);
    this.ghost = img;
  }

  private cancelDrag(): void { this.tracker = null; this.ghost?.remove(); this.ghost = null; }
}

function hoveredSlotElAt(x: number, y: number): { readonly el: HTMLElement; readonly source: DragSource } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(SLOT_SELECTOR);
  if (!el || el.closest("[hidden]")) return null;
  const source = sourceFromEl(el);
  return source ? { el, source } : null;
}

function rectForSource(source: DragSource): DOMRect | undefined {
  const sel = source.kind === KIND_CHEST ? `[data-chest-slot="${source.index}"]` : (source.kind === KIND_ARMOR ? `[data-armor-slot="${source.armorSlot}"]` : `[data-slot-index="${source.index}"]`);
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    if (!el.closest("[hidden]")) return el.getBoundingClientRect();
  }
  return undefined;
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
  const indexed = parseIndexedSource(slotEl.dataset.chestSlot, KIND_CHEST) ?? parseIndexedSource(slotEl.dataset.slotIndex, KIND_SLOT);
  if (indexed) return indexed;
  const armorSlot = slotEl.dataset.armorSlot as ArmorSlotKey | undefined;
  return armorSlot ? { kind: KIND_ARMOR, armorSlot } : null;
}