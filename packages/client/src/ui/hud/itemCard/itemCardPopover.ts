/** Pinned-on-tap (in panels) and non-blocking desktop-hover Item Card popover with zero-thrash caching. */
import { getRarityMeta, resolveItemInstance } from "@dc2d/content";
import { HOTBAR_SLOT_COUNT, type InventorySnapshot, type SlotItem, type WorldChestSnapshot } from "@dc2d/engine";
import { getItemIconUrl } from "../../icons/itemIcons.js";
import { dragSourceKey, isSameDragSource, type DragSource } from "../drag/slotDropResolver.js";
import { domNode, type HudActions } from "../slotRenderer.js";
import { buildItemStatLines, findComparisonItem, formatPerkLabels, type StatLine } from "./itemCardCompare.js";
import { ensureItemCardStyles } from "./itemCardStyles.js";

const BTN_PRIMARY = "ow-ic-btn-primary";

function resolveArmorSlotItem(inv: InventorySnapshot, source: Extract<DragSource, { kind: "armor" }>): SlotItem | null {
  const itemId = inv.armor[source.armorSlot];
  if (!itemId) return null;
  const prefixId = inv.armorPrefixes?.[source.armorSlot];
  return prefixId ? { itemId, count: 1, prefixId } : { itemId, count: 1 };
}

function resolveInspectedSlot(opts: {
  readonly source: DragSource; readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined;
}): SlotItem | null {
  if (opts.source.kind === "slot") return opts.inv.slots[opts.source.index] ?? null;
  if (opts.source.kind === "chest") return opts.chest?.slots[opts.source.index] ?? null;
  return resolveArmorSlotItem(opts.inv, opts.source);
}

const isConsumable = (def: ReturnType<typeof resolveItemInstance>["def"]): boolean =>
  Boolean(def && (def.healHp || def.wellFedSec || def.buffEffect || def.curesStatuses));

function buildStatNode(line: StatLine): HTMLDivElement {
  const row = domNode("div", "ow-ic-stat");
  const lbl = domNode("span", "ow-ic-stat-lbl");
  lbl.textContent = line.label;
  const val = domNode("span", "ow-ic-stat-val");
  val.textContent = line.value;
  if (line.deltaText) {
    const delta = domNode("span", "ow-ic-delta");
    delta.dataset.tone = line.deltaTone ?? "neutral";
    delta.textContent = `(${line.deltaText})`;
    val.append(delta);
  }
  row.append(lbl, val);
  return row;
}

function makeActionBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const btn = domNode("button", `ow-ic-btn ${cls}`);
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function slotItemFp(item: SlotItem | null): string {
  return item ? `${item.itemId}:${item.count}:${item.prefixId ?? ""}` : "-";
}

function applyPopoverPosition(el: HTMLElement, opts: {
  readonly rect: DOMRect | null; readonly cardH: number; readonly vw: number; readonly vh: number;
}): void {
  const { rect, cardH, vw, vh } = opts;
  if (!rect || vw < 680) {
    el.dataset.anchored = "false"; el.style.left = "50%"; el.style.top = "50%";
    return;
  }
  const cardW = Math.min(340, vw - 24);
  const placeRight = rect.right + 12 + cardW <= vw - 10;
  const rawX = placeRight ? rect.right + 10 : Math.max(10, rect.left - cardW - 10);
  const rawY = Math.max(10, Math.min(vh - cardH - 12, rect.top - 12));
  el.dataset.anchored = "true";
  el.style.left = `${Math.round(rawX)}px`;
  el.style.top = `${Math.round(rawY)}px`;
}

export class ItemCardPopover {
  readonly el: HTMLElement;
  private pinnedSource: DragSource | null = null;
  private pinnedRect: DOMRect | null = null;
  private hoverSource: DragSource | null = null;
  private hoverRect: DOMRect | null = null;
  private hoverTimer: number | null = null;
  private hoverReady = false;
  private lastRenderKey = "";
  private viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  private viewportH = typeof window !== "undefined" ? window.innerHeight : 720;

  constructor(host: HTMLElement, private readonly actions: HudActions) {
    ensureItemCardStyles();
    this.el = domNode("aside", "ow-item-card");
    this.el.hidden = true;
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    host.append(this.el);
    window.addEventListener("resize", () => { this.viewportW = window.innerWidth; this.viewportH = window.innerHeight; });
    window.addEventListener("pointerdown", (e) => {
      if (this.pinnedSource && !(e.target as HTMLElement | null)?.closest(".ow-item-card")) this.close();
    });
  }

  isOpen(): boolean { return !this.el.hidden && Boolean(this.pinnedSource); }

  open(source: DragSource, rect?: DOMRect): void {
    if (this.pinnedSource && isSameDragSource(this.pinnedSource, source)) { this.close(); return; }
    this.clearHoverTimer();
    this.hoverSource = null; this.hoverReady = false;
    this.pinnedSource = source; this.pinnedRect = rect ?? null;
    this.lastRenderKey = "";
  }

  close(): void {
    this.clearHoverTimer();
    this.pinnedSource = null; this.pinnedRect = null;
    this.hoverSource = null; this.hoverRect = null; this.hoverReady = false;
    this.lastRenderKey = "";
    this.el.hidden = true;
  }

  hover(source: DragSource | null, rect?: DOMRect): void {
    if (this.pinnedSource) return;
    if (!source) {
      this.clearHoverTimer(); this.hoverSource = null; this.hoverRect = null; this.hoverReady = false;
      this.lastRenderKey = ""; this.el.hidden = true;
      return;
    }
    this.hoverSource = source; this.hoverRect = rect ?? null;
    if (this.hoverReady || this.hoverTimer !== null) return;
    this.hoverTimer = window.setTimeout(() => { this.hoverTimer = null; this.hoverReady = true; }, 120);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) { window.clearTimeout(this.hoverTimer); this.hoverTimer = null; }
  }

  private pickActiveModeSource(): { readonly mode: "pinned" | "hover"; readonly source: DragSource; readonly anchor: DOMRect | null } | null {
    if (this.pinnedSource) return { mode: "pinned", source: this.pinnedSource, anchor: this.pinnedRect };
    if (this.hoverReady && this.hoverSource) return { mode: "hover", source: this.hoverSource, anchor: this.hoverRect };
    return null;
  }

  private resolveActiveView(inv: InventorySnapshot, chest?: WorldChestSnapshot) {
    const active = this.pickActiveModeSource();
    if (!active || (active.source.kind === "chest" && !chest)) return null;
    const item = resolveInspectedSlot({ source: active.source, inv, chest });
    if (item) return { ...active, item };
    if (active.mode === "pinned") this.close();
    return null;
  }

  private buildRenderKey(t: { readonly mode: string; readonly source: DragSource; readonly item: SlotItem; readonly anchor: DOMRect | null }, inv: InventorySnapshot, chest?: WorldChestSnapshot): string {
    const freeHotbar = inv.slots.slice(0, HOTBAR_SLOT_COUNT).findIndex((s) => s === null);
    const pos = `${Math.round(t.anchor?.left ?? 0)}:${Math.round(t.anchor?.top ?? 0)}`;
    return `${t.mode}|${dragSourceKey(t.source)}|${slotItemFp(t.item)}|${slotItemFp(inv.slots[inv.selectedHotbar] ?? null)}|${Boolean(chest)}|${freeHotbar}|${pos}`;
  }

  sync(inv: InventorySnapshot, chest?: WorldChestSnapshot): void {
    const target = this.resolveActiveView(inv, chest);
    if (!target) { this.el.hidden = true; return; }
    const key = this.buildRenderKey(target, inv, chest);
    if (key === this.lastRenderKey && !this.el.hidden) return;
    this.lastRenderKey = key;
    this.el.dataset.mode = target.mode;
    this.renderCard({ mode: target.mode, source: target.source, item: target.item, inv, chest });
    this.el.hidden = false;
    const cardH = this.el.offsetHeight || 260;
    applyPopoverPosition(this.el, { rect: target.anchor, cardH, vw: this.viewportW, vh: this.viewportH });
  }

  private renderCard(opts: {
    readonly mode: "pinned" | "hover"; readonly source: DragSource; readonly item: SlotItem;
    readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined;
  }): void {
    const { mode, source, item, inv, chest } = opts;
    const resolved = resolveItemInstance(item.itemId, item.prefixId);
    const meta = getRarityMeta(resolved.rarity);
    this.el.style.borderColor = meta.borderColor;
    this.el.style.boxShadow = `0 20px 52px rgba(0, 0, 0, 0.8), 0 0 24px ${meta.glowColor}`;
    const desc = domNode("p", "ow-ic-desc");
    desc.textContent = resolved.description;
    const statLines = buildItemStatLines(resolved, findComparisonItem(inv, item, source.kind === "armor"));
    const statsEl = domNode("div", "ow-ic-stats");
    if (statLines.length > 0) statsEl.append(...statLines.map(buildStatNode));
    else statsEl.hidden = true;
    const actionsEl = mode === "pinned" ? this.buildActionsNode({ source, resolved, inv, chest }) : domNode("div");
    if (mode !== "pinned") actionsEl.hidden = true;
    this.el.replaceChildren(this.buildHeader(item, resolved, meta), desc, statsEl, this.buildPerksNode(formatPerkLabels(resolved)), actionsEl);
  }

  private buildHeader(item: SlotItem, resolved: ReturnType<typeof resolveItemInstance>, meta: ReturnType<typeof getRarityMeta>): HTMLDivElement {
    const head = domNode("div", "ow-ic-head");
    const iconWrap = domNode("div", "ow-ic-icon-wrap");
    iconWrap.style.borderColor = meta.borderColor; iconWrap.style.background = meta.bgTint;
    const img = domNode("img", "ow-ic-icon");
    img.src = getItemIconUrl(item.itemId); img.alt = resolved.displayName;
    iconWrap.append(img);
    const titles = domNode("div", "ow-ic-titles");
    const name = domNode("div", "ow-ic-name");
    name.style.color = meta.color;
    name.textContent = resolved.displayName + (item.count > 1 ? ` ×${item.count}` : "");
    const sub = domNode("div", "ow-ic-sub");
    sub.style.color = meta.color;
    const slotNote = resolved.def?.armorSlot ? ` · ${resolved.def.armorSlot}` : (resolved.def?.twoHanded ? " · 2H" : "");
    sub.textContent = `${meta.label} · ${resolved.def?.category ?? "item"}${slotNote}`;
    titles.append(name, sub); head.append(iconWrap, titles);
    return head;
  }

  private buildPerksNode(perks: readonly string[]): HTMLDivElement {
    const wrap = domNode("div", "ow-ic-perks");
    if (perks.length === 0) { wrap.hidden = true; return wrap; }
    for (const text of perks) { const p = domNode("div", "ow-ic-perk"); p.textContent = `✦ ${text}`; wrap.append(p); }
    return wrap;
  }

  private appendUseOrMoveAction(bar: HTMLDivElement, sourceIndex: number, opts: {
    readonly resolved: ReturnType<typeof resolveItemInstance>; readonly inv: InventorySnapshot; readonly chestOpen: boolean;
  }): void {
    if (isConsumable(opts.resolved.def)) {
      bar.append(makeActionBtn("Use", BTN_PRIMARY, () => { this.actions.onUseItem?.(sourceIndex); this.close(); }));
    }
    if (opts.chestOpen || sourceIndex < HOTBAR_SLOT_COUNT) return;
    const freeHotbar = opts.inv.slots.slice(0, HOTBAR_SLOT_COUNT).findIndex((s) => s === null);
    if (freeHotbar >= 0) bar.append(makeActionBtn("To Hotbar", "", () => { this.actions.onMoveSlot({ from: sourceIndex, to: freeHotbar }); this.close(); }));
  }

  private appendBagOrHotbarActions(opts: {
    readonly bar: HTMLDivElement; readonly source: Extract<DragSource, { kind: "slot" }>;
    readonly resolved: ReturnType<typeof resolveItemInstance>; readonly inv: InventorySnapshot; readonly chestOpen: boolean;
  }): void {
    const { bar, source, resolved, chestOpen } = opts;
    if (chestOpen) {
      bar.append(makeActionBtn("Store", BTN_PRIMARY, () => {
        if (this.actions.onChestTransfer({ from: "inv", fromSlot: source.index, to: "chest", toSlot: 0, quick: true }) !== false) this.close();
      }));
    }
    if (resolved.def?.armorSlot) bar.append(makeActionBtn("Equip", BTN_PRIMARY, () => { this.actions.onEquipArmor({ slotIndex: source.index }); this.close(); }));
    this.appendUseOrMoveAction(bar, source.index, opts);
  }

  private appendContextualActions(opts: {
    readonly bar: HTMLDivElement; readonly source: DragSource;
    readonly resolved: ReturnType<typeof resolveItemInstance>; readonly inv: InventorySnapshot; readonly chestOpen: boolean;
  }): void {
    const { bar, source } = opts;
    if (source.kind === "chest") {
      bar.append(makeActionBtn("Take", BTN_PRIMARY, () => {
        if (this.actions.onChestTransfer({ from: "chest", fromSlot: source.index, to: "inv", toSlot: 0, quick: true }) !== false) this.close();
      }));
      return;
    }
    if (source.kind === "armor") {
      bar.append(makeActionBtn("Unequip", BTN_PRIMARY, () => { this.actions.onUnequipArmor({ armorSlot: source.armorSlot }); this.close(); }));
      return;
    }
    this.appendBagOrHotbarActions({ ...opts, source });
  }

  private buildActionsNode(opts: {
    readonly source: DragSource; readonly resolved: ReturnType<typeof resolveItemInstance>;
    readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined;
  }): HTMLDivElement {
    const bar = domNode("div", "ow-ic-actions");
    this.appendContextualActions({ bar, source: opts.source, resolved: opts.resolved, inv: opts.inv, chestOpen: Boolean(opts.chest) });
    bar.append(makeActionBtn("Drop", "ow-ic-btn-danger", () => { this.dispatchDrop(opts.source); this.close(); }));
    bar.append(makeActionBtn("Close", "", () => this.close()));
    return bar;
  }

  private dispatchDrop(source: DragSource): void {
    if (source.kind === "slot") this.actions.onDropItem({ source: "inv", slotIndex: source.index });
    else if (source.kind === "armor") this.actions.onDropItem({ source: "armor", armorSlot: source.armorSlot });
    else this.actions.onDropItem({ source: "chest", slotIndex: source.index });
  }
}