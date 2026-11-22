/** Shared DOM builders and stack-count-safe slot rendering for Phase 2 HUD. */
import { getItemDef, maxStackForItem } from "@dc2d/content";
import type { ArmorSlotKey, CharacterAppearance, InventorySlot, SlotItem } from "@dc2d/engine";
import { getItemIconUrl } from "../icons/itemIcons.js";

const ARMOR_LABELS: Readonly<Record<ArmorSlotKey, string>> = {
  head: "Head",
  chest: "Chest",
  legs: "Legs",
  feet: "Feet",
};

export interface HudActions {
  readonly onSelectHotbar: (slot: number) => void;
  readonly onMoveSlot: (move: { readonly from: number; readonly to: number }) => void;
  readonly onEquipArmor: (req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }) => void;
  readonly onUnequipArmor: (req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }) => void;
  readonly onCraft: (recipeId: string) => void;
  readonly onSetCharacter: (req: { readonly name: string; readonly appearance: CharacterAppearance }) => void;
}

export function domNode<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function renderSlotContent(
  btn: HTMLButtonElement,
  opts: {
    readonly item: InventorySlot;
    readonly keyLabel?: string | undefined;
    readonly emptyHint?: string | undefined;
    readonly selected?: boolean | undefined;
    readonly tapSource?: boolean | undefined;
  },
): void {
  btn.replaceChildren();
  btn.dataset.selected = String(Boolean(opts.selected));
  btn.dataset.tapSource = String(Boolean(opts.tapSource));

  if (opts.keyLabel) {
    const key = domNode("span", "ow-slot-key");
    key.textContent = opts.keyLabel;
    btn.append(key);
  }
  if (!opts.item) {
    btn.title = opts.emptyHint ?? "Empty slot";
    if (opts.emptyHint) {
      const hint = domNode("span", "ow-slot-hint");
      hint.textContent = opts.emptyHint;
      btn.append(hint);
    }
    return;
  }
  appendFilledSlotContent(btn, opts.item);
}

function appendFilledSlotContent(btn: HTMLButtonElement, item: SlotItem): void {
  const def = getItemDef(item.itemId);
  btn.title = def?.name ?? item.itemId;
  const img = domNode("img", "ow-slot-img");
  img.src = getItemIconUrl(item.itemId);
  img.alt = btn.title;
  img.draggable = false;
  btn.append(img);
  if (maxStackForItem(item.itemId) > 1 && item.count > 0) {
    const badge = domNode("span", "ow-slot-count");
    badge.textContent = String(item.count);
    btn.append(badge);
  }
}

export function armorLabel(key: ArmorSlotKey): string {
  return ARMOR_LABELS[key];
}

export function slotsFingerprint(slots: readonly InventorySlot[], start: number, count: number): string {
  const parts: string[] = [];
  for (let i = start; i < start + count; i++) {
    const s = slots[i];
    parts.push(s ? `${s.itemId}:${s.count}` : "-");
  }
  return parts.join("|");
}
