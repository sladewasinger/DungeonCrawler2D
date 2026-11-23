/** Unified pointer drag-and-drop and Shift-click chest transfer with forgiving gap snapping. */
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

interface DropCandidate {
  readonly source: DragSource;
  readonly edgeDist: number;
  readonly centerDist: number;
  readonly hasItem: boolean;
}

const DRAG_THRESHOLD_PX = 6;
const KIND_CHEST = "chest" as const;
const KIND_INV = "inv" as const;
const SLOT_SELECTOR = "[data-slot-index], [data-armor-slot], [data-chest-slot]";
const PANE_SELECTOR = ".ow-chest-pane, .ow-backpack-grid, .ow-armor-grid, .ow-hotbar, .ow-modal";

export class SlotDragManager {
  private tracker: PointerTracker | null = null;
  private ghost: HTMLImageElement | null = null;
  private latestInv: InventorySnapshot | null = null;
  private chestSlots: readonly InventorySlot[] | null = null;

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
    const isHotbar = source.kind === "slot" && source.index < HOTBAR_SLOT_COUNT;
    if (!itemId && !isHotbar) return;
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
      const target = this.findForgivingDropTarget(e.clientX, e.clientY, tracker.source);
      if (target) this.dispatchTransfer(tracker.source, target);
      return;
    }
    if (tracker.source.kind === "slot" && tracker.source.index < HOTBAR_SLOT_COUNT) {
      this.actions.onSelectHotbar(tracker.source.index);
    }
  }

  private findForgivingDropTarget(x: number, y: number, from: DragSource): DragSource | null {
    const hovered = document.elementFromPoint(x, y);
    const direct = hovered?.closest<HTMLElement>(SLOT_SELECTOR);
    const directSrc = direct ? sourceFromEl(direct) : null;
    if (directSrc) return directSrc;
    const scope = hovered?.closest<HTMLElement>(PANE_SELECTOR) ?? document.body;
    const maxEdgeDist = scope !== document.body ? 76 : 42;
    return this.pickNearestCandidate(scope, { x, y, maxEdgeDist, from });
  }

  private pickNearestCandidate(scope: ParentNode, opts: {
    readonly x: number; readonly y: number; readonly maxEdgeDist: number; readonly from: DragSource;
  }): DragSource | null {
    const list = this.collectCandidates(scope, opts);
    if (list.length === 0) return null;
    list.sort((a, b) => a.edgeDist - b.edgeDist || Number(a.hasItem) - Number(b.hasItem) || a.centerDist - b.centerDist);
    return list[0]!.source;
  }

  private collectCandidates(scope: ParentNode, opts: {
    readonly x: number; readonly y: number; readonly maxEdgeDist: number; readonly from: DragSource;
  }): DropCandidate[] {
    const list: DropCandidate[] = [];
    for (const el of scope.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      if (el.offsetParent === null) continue;
      const cand = measureDropCandidate(el, opts, (src) => Boolean(this.itemIdFor(src)));
      if (cand) list.push(cand);
    }
    return list;
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

function measureDropCandidate(
  el: HTMLElement,
  opts: { readonly x: number; readonly y: number; readonly maxEdgeDist: number; readonly from: DragSource },
  hasItemFn: (src: DragSource) => boolean,
): DropCandidate | null {
  const source = sourceFromEl(el);
  if (!source || sameSource(source, opts.from)) return null;
  const r = el.getBoundingClientRect();
  const edgeDist = Math.hypot(Math.max(r.left - opts.x, 0, opts.x - r.right), Math.max(r.top - opts.y, 0, opts.y - r.bottom));
  if (edgeDist > opts.maxEdgeDist) return null;
  const centerDist = Math.hypot(opts.x - (r.left + r.width * 0.5), opts.y - (r.top + r.height * 0.5));
  return { source, edgeDist, centerDist, hasItem: hasItemFn(source) };
}

function sourceFromEl(slotEl: HTMLElement): DragSource | null {
  const indexed = parseIndexedSource(slotEl.dataset.chestSlot, KIND_CHEST)
    ?? parseIndexedSource(slotEl.dataset.slotIndex, "slot");
  if (indexed) return indexed;
  const armorSlot = slotEl.dataset.armorSlot as ArmorSlotKey | undefined;
  return armorSlot ? { kind: "armor", armorSlot } : null;
}