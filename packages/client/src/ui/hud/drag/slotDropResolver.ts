/** Pure forgiving HUD drag-and-drop target resolution and outside-HUD world drop detection. */
import type { ArmorSlotKey, SlotItem } from "@dc2d/engine";

export type DragSource =
  | { readonly kind: "slot"; readonly index: number }
  | { readonly kind: "armor"; readonly armorSlot: ArmorSlotKey }
  | { readonly kind: "chest"; readonly index: number };

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type HudDropZone = "chest" | "backpack" | "hotbar" | "armor";

export interface MeasuredZone {
  readonly zone: HudDropZone | "modal";
  readonly rect: RectLike;
}

export interface MeasuredSlot {
  readonly source: DragSource;
  readonly zone: HudDropZone;
  readonly rect: RectLike;
  readonly item: SlotItem | null;
}

export type DropResolution =
  | { readonly kind: "worldDrop" }
  | { readonly kind: "transfer"; readonly target: DragSource }
  | { readonly kind: "none" };

const ZONE_CHEST = "chest" as const;
const ZONE_BACKPACK = "backpack" as const;
const ZONE_HOTBAR = "hotbar" as const;
const ZONE_ARMOR = "armor" as const;
const ZONE_MODAL = "modal" as const;
const OUTSIDE_DROP_MARGIN_PX = 26;

export function dragSourceKey(s: DragSource): string {
  return s.kind === ZONE_ARMOR ? `a:${s.armorSlot}` : `${s.kind}:${s.index}`;
}

export function isSameDragSource(a: DragSource, b: DragSource): boolean {
  return dragSourceKey(a) === dragSourceKey(b);
}

function edgeDistToRect(x: number, y: number, r: RectLike): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function centerDistToRect(x: number, y: number, r: RectLike): number {
  return Math.hypot(x - (r.left + r.right) * 0.5, y - (r.top + r.bottom) * 0.5);
}

function rectInset(x: number, y: number, r: RectLike): number {
  return Math.min(x - r.left, r.right - x, y - r.top, r.bottom - y);
}

function findZoneRect(zones: readonly MeasuredZone[], kind: MeasuredZone["zone"]): RectLike | undefined {
  return zones.find((z) => z.zone === kind)?.rect;
}

function minHudZoneDistance(x: number, y: number, zones: readonly MeasuredZone[]): number {
  let best = Infinity;
  for (const z of zones) best = Math.min(best, edgeDistToRect(x, y, z.rect));
  const modal = findZoneRect(zones, ZONE_MODAL);
  const hotbar = findZoneRect(zones, ZONE_HOTBAR);
  if (modal && hotbar && modal.bottom <= hotbar.top + 4) {
    const bridge: RectLike = {
      left: Math.min(modal.left, hotbar.left) - 16,
      right: Math.max(modal.right, hotbar.right) + 16,
      top: modal.bottom,
      bottom: hotbar.top,
    };
    best = Math.min(best, edgeDistToRect(x, y, bridge));
  }
  return best;
}

function resolveChestOrBagZone(opts: {
  readonly x: number; readonly y: number; readonly fromKind: DragSource["kind"];
  readonly chestRect: RectLike; readonly bagRect: RectLike;
}): HudDropZone {
  const dChest = edgeDistToRect(opts.x, opts.y, opts.chestRect);
  const dBag = edgeDistToRect(opts.x, opts.y, opts.bagRect);
  if (opts.fromKind === ZONE_CHEST) return dBag <= dChest + 10 ? ZONE_BACKPACK : ZONE_CHEST;
  return dChest <= dBag + 10 ? ZONE_CHEST : ZONE_BACKPACK;
}

function resolveTargetZone(opts: {
  readonly x: number; readonly y: number; readonly fromKind: DragSource["kind"];
  readonly zones: readonly MeasuredZone[];
}): HudDropZone {
  const { x, y, fromKind, zones } = opts;
  const hotbarRect = findZoneRect(zones, ZONE_HOTBAR);
  const modalRect = findZoneRect(zones, ZONE_MODAL);
  if (hotbarRect && (!modalRect || edgeDistToRect(x, y, hotbarRect) < edgeDistToRect(x, y, modalRect))) {
    return ZONE_HOTBAR;
  }
  const chestRect = findZoneRect(zones, ZONE_CHEST);
  const bagRect = findZoneRect(zones, ZONE_BACKPACK);
  if (chestRect && bagRect) return resolveChestOrBagZone({ x, y, fromKind, chestRect, bagRect });
  return chestRect && !bagRect ? ZONE_CHEST : ZONE_BACKPACK;
}

interface MatchQuery {
  readonly s: MeasuredSlot; readonly itemId: string; readonly maxStack: number; readonly prefixId?: string | undefined;
}

function canMergeSlot(q: MatchQuery): boolean {
  const samePrefix = (q.s.item?.prefixId ?? undefined) === (q.prefixId ?? undefined);
  return q.s.item !== null && q.s.item.itemId === q.itemId && samePrefix && q.maxStack > 1 && q.s.item.count < q.maxStack;
}

function isAvailableSlot(q: MatchQuery): boolean {
  return q.s.item === null || canMergeSlot(q);
}

interface SlotScore { readonly source: DragSource; readonly p: number; readonly sec: number }

function scoreSlot(s: MeasuredSlot, opts: { readonly x: number; readonly y: number; readonly byCenter: boolean }): SlotScore {
  const c = centerDistToRect(opts.x, opts.y, s.rect);
  const e = edgeDistToRect(opts.x, opts.y, s.rect);
  return { source: s.source, p: opts.byCenter ? c : e, sec: opts.byCenter ? e : c };
}

function isBetterScore(cand: SlotScore, best: SlotScore): boolean {
  return cand.p < best.p - 0.01 || (Math.abs(cand.p - best.p) <= 0.01 && cand.sec < best.sec);
}

function pickBestSlot(slots: readonly MeasuredSlot[], opts: { readonly x: number; readonly y: number; readonly byCenter: boolean }): DragSource | null {
  if (slots.length === 0) return null;
  let best = scoreSlot(slots[0]!, opts);
  for (let i = 1; i < slots.length; i++) {
    const cand = scoreSlot(slots[i]!, opts);
    if (isBetterScore(cand, best)) best = cand;
  }
  return best.source;
}

function findCompanionSpill(opts: {
  readonly x: number; readonly y: number; readonly from: DragSource; readonly targetZone: HudDropZone;
  readonly itemId: string; readonly maxStack: number; readonly prefixId?: string | undefined; readonly slots: readonly MeasuredSlot[];
}): DragSource | null {
  const { x, y, from, targetZone, itemId, maxStack, prefixId, slots } = opts;
  if (targetZone !== ZONE_BACKPACK && targetZone !== ZONE_HOTBAR) return null;
  const companion = targetZone === ZONE_BACKPACK ? ZONE_HOTBAR : ZONE_BACKPACK;
  const spill = slots.filter((s) => s.zone === companion && !isSameDragSource(s.source, from) && isAvailableSlot({ s, itemId, maxStack, prefixId }));
  return spill.length > 0 ? pickBestSlot(spill, { x, y, byCenter: true }) : null;
}

function resolveCrossContainerSlot(opts: {
  readonly x: number; readonly y: number; readonly from: DragSource; readonly targetZone: HudDropZone;
  readonly itemId: string; readonly maxStack: number; readonly prefixId?: string | undefined; readonly slots: readonly MeasuredSlot[];
}): DragSource | null {
  const { x, y, from, targetZone, itemId, maxStack, prefixId, slots } = opts;
  const targetSlots = slots.filter((s) => s.zone === targetZone && !isSameDragSource(s.source, from));
  const direct = targetSlots.find((s) => edgeDistToRect(x, y, s.rect) === 0);
  if (direct && isAvailableSlot({ s: direct, itemId, maxStack, prefixId })) return direct.source;
  const mergeNear = targetSlots.filter((s) => canMergeSlot({ s, itemId, maxStack, prefixId }) && edgeDistToRect(x, y, s.rect) <= 18);
  if (mergeNear.length > 0) return pickBestSlot(mergeNear, { x, y, byCenter: true });
  const avail = targetSlots.filter((s) => isAvailableSlot({ s, itemId, maxStack, prefixId }));
  if (avail.length > 0) return pickBestSlot(avail, { x, y, byCenter: true });
  if (direct) return direct.source;
  return findCompanionSpill(opts) ?? pickBestSlot(targetSlots.filter((s) => edgeDistToRect(x, y, s.rect) <= 20), { x, y, byCenter: false });
}

function resolveSameContainerSlot(opts: {
  readonly x: number; readonly y: number; readonly from: DragSource; readonly targetZone: HudDropZone;
  readonly itemId: string; readonly maxStack: number; readonly prefixId?: string | undefined; readonly slots: readonly MeasuredSlot[];
}): DragSource | null {
  const { x, y, from, targetZone, itemId, maxStack, prefixId, slots } = opts;
  const zoneSlots = slots.filter((s) => s.zone === targetZone);
  const hit = zoneSlots.find((s) => edgeDistToRect(x, y, s.rect) === 0);
  if (hit) {
    if (isSameDragSource(from, hit.source)) return null;
    if (isAvailableSlot({ s: hit, itemId, maxStack, prefixId }) || rectInset(x, y, hit.rect) >= 5) return hit.source;
  }
  const others = zoneSlots.filter((s) => !isSameDragSource(from, s.source));
  const nearAvail = others.filter((s) => isAvailableSlot({ s, itemId, maxStack, prefixId }) && edgeDistToRect(x, y, s.rect) <= 24);
  if (nearAvail.length > 0) return pickBestSlot(nearAvail, { x, y, byCenter: false });
  return pickBestSlot(others.filter((s) => edgeDistToRect(x, y, s.rect) <= 36), { x, y, byCenter: false });
}

function tryArmorZoneTarget(opts: {
  readonly x: number; readonly y: number; readonly from: DragSource;
  readonly itemArmorSlot?: ArmorSlotKey | undefined; readonly zones: readonly MeasuredZone[];
}): DragSource | null {
  if (!opts.itemArmorSlot || opts.from.kind === ZONE_ARMOR) return null;
  const armorRect = findZoneRect(opts.zones, ZONE_ARMOR);
  if (!armorRect) return null;
  const bagRect = findZoneRect(opts.zones, ZONE_BACKPACK);
  const limit = Math.min(24, bagRect ? edgeDistToRect(opts.x, opts.y, bagRect) : Infinity);
  return edgeDistToRect(opts.x, opts.y, armorRect) <= limit ? { kind: ZONE_ARMOR, armorSlot: opts.itemArmorSlot } : null;
}

export function resolvePointerDrop(input: {
  readonly x: number;
  readonly y: number;
  readonly from: DragSource;
  readonly itemId: string;
  readonly maxStack: number;
  readonly prefixId?: string | undefined;
  readonly itemArmorSlot?: ArmorSlotKey | undefined;
  readonly zones: readonly MeasuredZone[];
  readonly slots: readonly MeasuredSlot[];
}): DropResolution {
  if (input.zones.length > 0 && minHudZoneDistance(input.x, input.y, input.zones) > OUTSIDE_DROP_MARGIN_PX) {
    return { kind: "worldDrop" };
  }
  const armorTarget = tryArmorZoneTarget(input);
  if (armorTarget) return { kind: "transfer", target: armorTarget };
  const targetZone = resolveTargetZone({ x: input.x, y: input.y, fromKind: input.from.kind, zones: input.zones });
  const crossContainer = (input.from.kind === ZONE_CHEST) !== (targetZone === ZONE_CHEST) || input.from.kind === ZONE_ARMOR;
  const target = crossContainer
    ? resolveCrossContainerSlot({ ...input, targetZone })
    : resolveSameContainerSlot({ ...input, targetZone });
  return target ? { kind: "transfer", target } : { kind: "none" };
}
