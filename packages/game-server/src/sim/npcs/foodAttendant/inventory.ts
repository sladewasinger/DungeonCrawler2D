export interface FoodAttendantInventoryEntry {
  itemId: string;
  price: number;
}

/** Reserved storefront inventory; interactions arrive in a later release. */
export const FOOD_ATTENDANT_INVENTORY: readonly FoodAttendantInventoryEntry[] = [];
