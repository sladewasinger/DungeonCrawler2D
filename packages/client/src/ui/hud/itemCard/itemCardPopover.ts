/** Tap-to-inspect Item Card popover with 64px pixel preview, rarity glow, equip diff, and actions. */
import { getRarityMeta, resolveItemInstance } from "@dc2d/content";
import { HOTBAR_SLOT_COUNT, type InventorySnapshot, type SlotItem, type WorldChestSnapshot } from "@dc2d/engine";
import { getItemIconUrl } from "../../icons/itemIcons.js";
import type { DragSource } from "../drag/slotDropResolver.js";
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
  const { source, inv, chest } = opts;
  if (source.kind === "slot") return inv.slots[source.index] ?? null;
  if (source.kind === "chest") return chest?.slots[source.index] ?? null;
  return resolveArmorSlotItem(inv, source);
}

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

export class ItemCardPopover {
  readonly el: HTMLElement;
  private source: DragSource | null = null;

  constructor(host: HTMLElement, private readonly actions: HudActions) {
    ensureItemCardStyles();
    this.el = domNode("aside", "ow-item-card");
    this.el.hidden = true;
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    host.append(this.el);
    window.addEventListener("pointerdown", (e) => {
      if (!this.el.hidden && !(e.target as HTMLElement | null)?.closest(".ow-item-card")) this.close();
    });
  }

  isOpen(): boolean { return !this.el.hidden; }
  open(source: DragSource): void { this.source = source; this.el.hidden = false; }
  close(): void { this.source = null; this.el.hidden = true; }

  sync(inv: InventorySnapshot, chest?: WorldChestSnapshot): void {
    if (!this.source) { this.el.hidden = true; return; }
    const item = resolveInspectedSlot({ source: this.source, inv, chest });
    if (!item) { this.close(); return; }
    this.renderCard(this.source, item, inv);
  }

  private renderCard(source: DragSource, item: SlotItem, inv: InventorySnapshot): void {
    const resolved = resolveItemInstance(item.itemId, item.prefixId);
    const meta = getRarityMeta(resolved.rarity);
    this.el.style.borderColor = meta.borderColor;
    this.el.style.boxShadow = `0 20px 52px rgba(0, 0, 0, 0.8), 0 0 24px ${meta.glowColor}`;

    const head = this.buildHeader(item, resolved, meta);
    const desc = domNode("p", "ow-ic-desc");
    desc.textContent = resolved.description;
    const statLines = buildItemStatLines(resolved, findComparisonItem(inv, item, source.kind === "armor"));
    const statsEl = domNode("div", "ow-ic-stats");
    if (statLines.length > 0) statsEl.append(...statLines.map(buildStatNode));
    else statsEl.hidden = true;

    this.el.replaceChildren(head, desc, statsEl, this.buildPerksNode(formatPerkLabels(resolved)), this.buildActionsNode(source, resolved, inv));
  }

  private buildHeader(item: SlotItem, resolved: ReturnType<typeof resolveItemInstance>, meta: ReturnType<typeof getRarityMeta>): HTMLDivElement {
    const head = domNode("div", "ow-ic-head");
    const iconWrap = domNode("div", "ow-ic-icon-wrap");
    iconWrap.style.borderColor = meta.borderColor;
    iconWrap.style.background = meta.bgTint;
    const img = domNode("img", "ow-ic-icon");
    img.src = getItemIconUrl(item.itemId);
    img.alt = resolved.displayName;
    iconWrap.append(img);

    const titles = domNode("div", "ow-ic-titles");
    const name = domNode("div", "ow-ic-name");
    name.style.color = meta.color;
    name.textContent = resolved.displayName + (item.count > 1 ? ` ×${item.count}` : "");
    const sub = domNode("div", "ow-ic-sub");
    sub.style.color = meta.color;
    const slotNote = resolved.def?.armorSlot ? ` · ${resolved.def.armorSlot}` : (resolved.def?.twoHanded ? " · 2H" : "");
    sub.textContent = `${meta.label} · ${resolved.def?.category ?? "item"}${slotNote}`;
    titles.append(name, sub);
    head.append(iconWrap, titles);
    return head;
  }

  private buildPerksNode(perks: readonly string[]): HTMLDivElement {
    const wrap = domNode("div", "ow-ic-perks");
    if (perks.length === 0) { wrap.hidden = true; return wrap; }
    for (const text of perks) {
      const p = domNode("div", "ow-ic-perk");
      p.textContent = `✦ ${text}`;
      wrap.append(p);
    }
    return wrap;
  }

  private appendEquipAction(bar: HTMLDivElement, source: DragSource, def: ReturnType<typeof resolveItemInstance>["def"]): void {
    if (source.kind === "slot" && def?.armorSlot) {
      bar.append(makeActionBtn("Equip", BTN_PRIMARY, () => { this.actions.onEquipArmor({ slotIndex: source.index }); this.close(); }));
    } else if (source.kind === "armor") {
      bar.append(makeActionBtn("Unequip", BTN_PRIMARY, () => { this.actions.onUnequipArmor({ armorSlot: source.armorSlot }); this.close(); }));
    }
  }

  private appendUseAction(bar: HTMLDivElement, source: DragSource, def: ReturnType<typeof resolveItemInstance>["def"]): void {
    if (source.kind !== "slot" || !def) return;
    if (def.healHp || def.wellFedSec || def.buffEffect || def.curesStatuses) {
      bar.append(makeActionBtn("Use", BTN_PRIMARY, () => { this.actions.onUseItem?.(source.index); this.close(); }));
    }
  }

  private buildActionsNode(source: DragSource, resolved: ReturnType<typeof resolveItemInstance>, inv: InventorySnapshot): HTMLDivElement {
    const bar = domNode("div", "ow-ic-actions");
    this.appendEquipAction(bar, source, resolved.def);
    this.appendUseAction(bar, source, resolved.def);
    if (source.kind === "slot" && source.index >= HOTBAR_SLOT_COUNT) {
      const freeHotbar = inv.slots.slice(0, HOTBAR_SLOT_COUNT).findIndex((s) => s === null);
      if (freeHotbar >= 0) bar.append(makeActionBtn("To Hotbar", "", () => { this.actions.onMoveSlot({ from: source.index, to: freeHotbar }); this.close(); }));
    }
    bar.append(makeActionBtn("Drop", "ow-ic-btn-danger", () => { this.dispatchDrop(source); this.close(); }));
    bar.append(makeActionBtn("Close", "", () => this.close()));
    return bar;
  }

  private dispatchDrop(source: DragSource): void {
    if (source.kind === "slot") this.actions.onDropItem({ source: "inv", slotIndex: source.index });
    else if (source.kind === "armor") this.actions.onDropItem({ source: "armor", armorSlot: source.armorSlot });
    else this.actions.onDropItem({ source: "chest", slotIndex: source.index });
  }
}
