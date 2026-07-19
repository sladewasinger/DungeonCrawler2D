/**
 * Pure inventory tab/row view-model derivation — no Phaser — so it round-trips
 * through a plain vitest test, mirroring hotbarSlots.ts's split from its widget.
 */
import type { InventoryRowData } from "./fakeData.js";

export type InventoryTabId = "all" | "weapons" | "usables" | "materials";

export interface InventoryTabDef {
  id: InventoryTabId;
  label: string;
}

/** v1's four filter tabs, ported verbatim (HUD_OS.md §5 — fixed mode until Phase 3's shared tabBar.ts lift). */
export const INVENTORY_TABS: readonly InventoryTabDef[] = [
  { id: "all", label: "All" },
  { id: "weapons", label: "Weapons" },
  { id: "usables", label: "Usables" },
  { id: "materials", label: "Materials" },
];

export interface InventoryRowView {
  itemId: string;
  name: string;
  qty: number;
  boundSlot: number | null;
  isWeapon: boolean;
}

/**
 * Rows for the active tab, sorted by display name. No pagination/scroll model yet —
 * the widget caps how many of these it renders to what the fixed panel height holds
 * (HUD_OS.md Phase 1 defers a real scroll region to Phase 2's resizable windows).
 */
export function inventoryRowViews(rows: readonly InventoryRowData[], activeTab: InventoryTabId): InventoryRowView[] {
  return rows
    .filter((row) => activeTab === "all" || row.category === activeTab)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({
      itemId: row.itemId,
      name: row.name,
      qty: row.qty,
      boundSlot: row.boundSlot,
      isWeapon: row.category === "weapons",
    }));
}
