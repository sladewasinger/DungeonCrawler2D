/** Builds renderer-neutral live view models for the browser-native shared HTML HUD. */
import type { ActiveStatusSnapshot, InvStack } from "@dc2d/engine";
import {
  isConsumableItem,
  isThrowableItem,
  isWeaponItem,
  itemCategory,
  itemFlavor,
  itemName,
  type ItemCategory,
} from "../../../ui/presentation/itemCatalog.js";
import { statusPresentations } from "../../../ui/presentation/statusPresentation.js";

export interface InventoryRow {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly category: ItemCategory;
  readonly flavor?: string;
  readonly boundSlot: number | null;
  readonly canEquip: boolean;
  readonly canUse: boolean;
  readonly canHotbar: boolean;
}

export interface StatusView {
  readonly id: string;
  readonly kind: "buff" | "debuff";
  readonly remainingSeconds: number;
  readonly durationSeconds: number;
}

export const inventoryRows = (
  inventory: readonly InvStack[],
  hotbar: readonly (string | null)[],
): InventoryRow[] => inventory.map((stack): InventoryRow => {
  const boundSlot = hotbar.indexOf(stack.item);
  const flavor = itemFlavor(stack.item);
  return {
    id: stack.item,
    name: itemName(stack.item),
    quantity: stack.qty,
    category: itemCategory(stack.item),
    ...(flavor ? { flavor } : {}),
    boundSlot: boundSlot < 0 ? null : boundSlot,
    canEquip: isWeaponItem(stack.item),
    canUse: isConsumableItem(stack.item),
    canHotbar: isConsumableItem(stack.item) || isThrowableItem(stack.item),
  };
}).sort((left, right) => left.name.localeCompare(right.name));

export const statusViews = (
  active: readonly ActiveStatusSnapshot[],
  fallbackIds: readonly string[],
): StatusView[] => statusPresentations(active, fallbackIds);

export const hotbarQuantity = (
  inventory: readonly InvStack[],
  itemId: string | null,
): number => itemId
  ? inventory.find((stack) => stack.item === itemId)?.qty ?? 0
  : 0;

export const nextAvailableHotbarSlot = (
  hotbar: readonly (string | null)[],
  itemId: string,
): number => {
  const existing = hotbar.indexOf(itemId);
  return existing >= 0 ? existing : hotbar.findIndex((item) => item === null);
};

export interface AutoHealingVisibilityInput {
  hp: number;
  maxHp: number;
  regenerationDelaySeconds: number;
  actionable?: boolean;
}

export const shouldShowAutoHealing = ({
  hp,
  maxHp,
  regenerationDelaySeconds,
  actionable = true,
}: AutoHealingVisibilityInput): boolean =>
  actionable && hp > 0 && hp < maxHp && regenerationDelaySeconds <= 0;
