/** Owns client-side item presentation metadata shared by both renderers. */
import { itemsData } from "@dc2d/content";
import type { ArmorSlot, ItemArmorDef, ItemRangedDef } from "@dc2d/engine";

interface ItemDefinition {
  readonly id: string;
  readonly name?: string;
  readonly weapon?: { readonly cooldownMs?: number; readonly damage?: number };
  readonly ranged?: ItemRangedDef;
  readonly armor?: ItemArmorDef;
  readonly consumable?: unknown;
  readonly throwable?: unknown;
  readonly flavor?: string;
}

const isItemDefinition = (value: unknown): value is ItemDefinition =>
  typeof (value as Partial<ItemDefinition>)?.id === "string";

const items = new Map<string, ItemDefinition>(
  (itemsData as readonly unknown[])
    .filter(isItemDefinition)
    .map((definition) => [definition.id, definition]),
);

export type ItemCategory = "weapons" | "usables" | "materials";

export const isThrowableItem = (itemId: string): boolean =>
  Boolean(items.get(itemId)?.throwable);

export const isConsumableItem = (itemId: string): boolean =>
  Boolean(items.get(itemId)?.consumable);

export const isWeaponItem = (itemId: string): boolean =>
  Boolean(items.get(itemId)?.weapon);

export const isRangedWeaponItem = (itemId: string): boolean =>
  Boolean(items.get(itemId)?.ranged);

export const itemRangedDef = (itemId: string | null): ItemRangedDef | null =>
  itemId ? (items.get(itemId)?.ranged ?? null) : null;

export const isArmorItem = (itemId: string): boolean =>
  Boolean(items.get(itemId)?.armor);

export const itemArmorDef = (itemId: string | null): ItemArmorDef | null =>
  itemId ? (items.get(itemId)?.armor ?? null) : null;

export const itemArmorSlot = (itemId: string): ArmorSlot | null =>
  items.get(itemId)?.armor?.slot ?? null;

export const isHotbarBindableItem = (itemId: string): boolean =>
  isWeaponItem(itemId) || isConsumableItem(itemId) || isThrowableItem(itemId);

export const itemCategory = (itemId: string): ItemCategory => {
  if (isWeaponItem(itemId) || isArmorItem(itemId)) return "weapons";
  if (isConsumableItem(itemId) || isThrowableItem(itemId)) return "usables";
  return "materials";
};

export const itemName = (itemId: string): string =>
  items.get(itemId)?.name ?? itemId;

export const itemFlavor = (itemId: string): string | undefined =>
  items.get(itemId)?.flavor;

export const weaponCooldownMs = (
  itemId: string | null,
  fallbackMs: number,
): number => (itemId ? items.get(itemId)?.weapon?.cooldownMs : undefined) ?? fallbackMs;
