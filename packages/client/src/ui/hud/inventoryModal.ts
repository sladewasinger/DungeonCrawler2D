/** Minimalist 36-slot backpack (slots 9..35) + 5 armor slots + stats modal (no duplicate hotbar). */
import { resolveItemInstance } from "@dc2d/content";
import {
  ARMOR_SLOT_KEYS, BACKPACK_SLOT_COUNT, HOTBAR_SLOT_COUNT, computePlayerGearStats,
  type ArmorSlotKey, type InventorySnapshot, type PlayerSnapshot,
} from "@dc2d/engine";
import type { DragSource, SlotDragManager } from "./slotDragManager.js";
import { armorLabel, domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

const TAG_DIV = "div";
const TAG_BTN = "button";
const CLS_SLOT = "ow-slot ow-bag-slot";

function playerStatsFp(player: PlayerSnapshot | undefined): string {
  if (!player) return "100/100:100";
  return `${Math.round(player.hp ?? 100)}/${Math.round(player.maxHp ?? 100)}:${Math.round(player.stamina ?? 100)}`;
}

function buildInventoryFingerprint(
  inv: InventorySnapshot,
  heldId: string,
  extra: { readonly tapSource: DragSource | null; readonly player: PlayerSnapshot | undefined },
): string {
  const armorFp = ARMOR_SLOT_KEYS.map((k) => `${inv.armor[k] ?? "-"}:${inv.armorPrefixes?.[k] ?? ""}`).join(",");
  const bagFp = slotsFingerprint(inv.slots, HOTBAR_SLOT_COUNT, BACKPACK_SLOT_COUNT);
  return `${armorFp}#${bagFp}#${heldId}#${tapSourceFingerprint(extra.tapSource)}#${playerStatsFp(extra.player)}`;
}

function tapSourceFingerprint(tap: DragSource | null): string {
  if (!tap) return "none";
  return tap.kind === "armor" ? tap.armorSlot : String(tap.index);
}

export class InventoryModal {
  readonly el: HTMLElement;
  private readonly armorButtons = new Map<ArmorSlotKey, HTMLButtonElement>();
  private readonly bagButtons: HTMLButtonElement[] = [];
  private readonly armorItemKeys = new Map<ArmorSlotKey, string>();
  private readonly bagItemKeys: string[] = Array.from({ length: BACKPACK_SLOT_COUNT }, () => "");
  private readonly statsEl: HTMLDivElement;
  private lastFingerprint = "";

  constructor(
    host: HTMLElement,
    drag: SlotDragManager,
    nav: { readonly onClose: () => void; readonly onOpenCrafting: () => void },
  ) {
    this.el = domNode("section", "ow-modal ow-inv-modal");
    this.el.hidden = true;
    this.el.append(buildModalHeader(nav));
    const body = domNode(TAG_DIV, "ow-inv-body");
    const leftCol = domNode(TAG_DIV, "ow-armor-wrap");
    leftCol.append(this.buildArmorGrid(drag));
    this.statsEl = domNode(TAG_DIV, "ow-stats-box");
    leftCol.append(this.statsEl);
    body.append(leftCol, this.buildBackpackGrid(drag));
    this.el.append(body);
    host.append(this.el);
  }

  private buildArmorGrid(drag: SlotDragManager): HTMLDivElement {
    const grid = domNode(TAG_DIV, "ow-armor-grid");
    grid.dataset.dropZone = "armor";
    for (const key of ARMOR_SLOT_KEYS) {
      const btn = domNode(TAG_BTN, CLS_SLOT);
      btn.type = TAG_BTN;
      btn.setAttribute("aria-label", `${armorLabel(key)} armor slot`);
      drag.bindSlot(btn, { kind: "armor", armorSlot: key });
      this.armorButtons.set(key, btn);
      grid.append(btn);
    }
    return grid;
  }

  private buildBackpackGrid(drag: SlotDragManager): HTMLDivElement {
    const grid = domNode(TAG_DIV, "ow-backpack-grid");
    grid.dataset.dropZone = "backpack";
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) {
      const slotIndex = HOTBAR_SLOT_COUNT + i;
      const btn = domNode(TAG_BTN, CLS_SLOT);
      btn.type = TAG_BTN;
      btn.setAttribute("aria-label", `Backpack slot ${i + 1}`);
      drag.bindSlot(btn, { kind: "slot", index: slotIndex });
      this.bagButtons.push(btn);
      grid.append(btn);
    }
    return grid;
  }

  sync(inv: InventorySnapshot, opts: {
    readonly open: boolean;
    readonly tapSource: DragSource | null;
    readonly player?: PlayerSnapshot | undefined;
  }): void {
    this.el.hidden = !opts.open;
    if (opts.open) this.syncOpenModal(inv, opts.tapSource, opts.player);
  }

  private syncOpenModal(inv: InventorySnapshot, tapSource: DragSource | null, player: PlayerSnapshot | undefined): void {
    const heldId = inv.slots[inv.selectedHotbar]?.itemId ?? "-";
    const fp = buildInventoryFingerprint(inv, heldId, { tapSource, player });
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;
    for (const key of ARMOR_SLOT_KEYS) this.syncSingleArmor(key, inv, tapSource);
    const tapIdx = tapSource?.kind === "slot" ? tapSource.index : -1;
    for (let i = 0; i < BACKPACK_SLOT_COUNT; i++) this.syncSingleBagSlot(i, inv, tapIdx);
    this.syncStats(inv, heldId, player);
  }

  private syncSingleArmor(key: ArmorSlotKey, inv: InventorySnapshot, tapSource: DragSource | null): void {
    const btn = this.armorButtons.get(key);
    if (!btn) return;
    const itemId = inv.armor[key];
    const prefixId = inv.armorPrefixes?.[key];
    const itemKey = itemId ? `${itemId}:${prefixId ?? ""}` : "-";
    const tap = tapSource?.kind === "armor" && tapSource.armorSlot === key;
    if (this.armorItemKeys.get(key) === itemKey) { btn.dataset.tapSource = String(tap); return; }
    this.armorItemKeys.set(key, itemKey);
    renderSlotContent(btn, { item: buildArmorSlotItem(itemId, prefixId), emptyHint: armorLabel(key), tapSource: tap });
  }

  private syncSingleBagSlot(bagIdx: number, inv: InventorySnapshot, tapIdx: number): void {
    const btn = this.bagButtons[bagIdx];
    if (!btn) return;
    const slotIndex = HOTBAR_SLOT_COUNT + bagIdx;
    const item = inv.slots[slotIndex] ?? null;
    const itemKey = item ? `${item.itemId}:${item.count}:${item.prefixId ?? ""}` : "-";
    const tap = tapIdx === slotIndex;
    if (this.bagItemKeys[bagIdx] === itemKey) {
      btn.dataset.tapSource = String(tap);
      return;
    }
    this.bagItemKeys[bagIdx] = itemKey;
    renderSlotContent(btn, { item, tapSource: tap });
  }

  private syncStats(inv: InventorySnapshot, heldId: string, player: PlayerSnapshot | undefined): void {
    const rows = formatStatRows({ inv, heldId, player });
    this.statsEl.replaceChildren(...rows.map((text) => {
      const line = domNode(TAG_DIV);
      line.textContent = text;
      return line;
    }));
  }
}

function buildArmorSlotItem(itemId: string | null, prefixId: string | undefined) {
  if (!itemId) return null;
  return prefixId ? { itemId, count: 1, prefixId } : { itemId, count: 1 };
}

function formatHeldName(inv: InventorySnapshot): string {
  const held = inv.slots[inv.selectedHotbar];
  if (!held) return "Unarmed";
  return resolveItemInstance(held.itemId, held.prefixId).displayName;
}

function formatStatRows(opts: {
  readonly inv: InventorySnapshot; readonly heldId: string; readonly player: PlayerSnapshot | undefined;
}): readonly string[] {
  const held = opts.inv.slots[opts.inv.selectedHotbar];
  const gear = computePlayerGearStats({
    armor: opts.inv.armor, armorPrefixes: opts.inv.armorPrefixes, heldItem: held,
    lookup: (id, pId) => resolveItemInstance(id, pId),
  });
  const p = opts.player;
  const hp = p?.hp ?? 100;
  const maxHp = p?.maxHp ?? (100 + gear.maxHpBonus);
  const stam = p?.stamina ?? 100;
  return [
    `HP: ${Math.round(hp)} / ${Math.round(maxHp)}`,
    `Stamina: ${Math.round(stam)}`,
    `Defense: ${gear.defense} · Crit: ${Math.round(gear.critChance * 100)}%`,
    `Dmg: ${gear.heldDamage || 8} · Spd: ${Math.round((1 + gear.moveSpeedMult) * 100)}%`,
    `Held: ${formatHeldName(opts.inv)}`,
    "Tap item to inspect · Q Drop",
  ];
}

function buildModalHeader(nav: { readonly onClose: () => void; readonly onOpenCrafting: () => void }): HTMLDivElement {
  const head = domNode(TAG_DIV, "ow-modal-head");
  const title = domNode("span");
  title.textContent = "Inventory";
  const right = domNode(TAG_DIV);
  right.style.display = "flex";
  right.style.gap = "6px";
  const craftBtn = domNode(TAG_BTN, "ow-pill");
  craftBtn.type = TAG_BTN;
  craftBtn.textContent = "Craft";
  craftBtn.addEventListener("click", nav.onOpenCrafting);
  const closeBtn = domNode(TAG_BTN, "ow-pill");
  closeBtn.type = TAG_BTN;
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", nav.onClose);
  right.append(craftBtn, closeBtn);
  head.append(title, right);
  return head;
}
