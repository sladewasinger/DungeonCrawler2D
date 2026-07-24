/** Builds renderer-neutral live view models for the browser-native Three.js HUD. */
import { statusesData } from "@dc2d/content";
import type { InvStack } from "@dc2d/engine";
import {
  isConsumableItem,
  isThrowableItem,
  isWeaponItem,
  itemCategory,
  itemFlavor,
  itemName,
  type ItemCategory,
} from "../ui/itemCatalog.js";

interface StatusDefinition {
  readonly id: string;
  readonly kind: "buff" | "debuff";
}

export interface ThreeInventoryRow {
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

export interface ThreeStatusView {
  readonly id: string;
  readonly kind: "buff" | "debuff";
}

const isStatusDefinition = (value: unknown): value is StatusDefinition => {
  const status = value as Partial<StatusDefinition>;
  return typeof status.id === "string" &&
    (status.kind === "buff" || status.kind === "debuff");
};

const statuses = new Map<string, StatusDefinition>(
  (statusesData as readonly unknown[])
    .filter(isStatusDefinition)
    .map((status) => [status.id, status]),
);

export const inventoryRows = (
  inventory: readonly InvStack[],
  hotbar: readonly (string | null)[],
): ThreeInventoryRow[] => inventory.map((stack): ThreeInventoryRow => {
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

export const statusViews = (active: readonly string[]): ThreeStatusView[] =>
  active.map((id) => ({
    id,
    kind: statuses.get(id)?.kind ?? "debuff",
  }));

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
