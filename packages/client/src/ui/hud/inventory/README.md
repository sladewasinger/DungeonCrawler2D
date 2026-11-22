# Minecraft-Style Inventory Workspace (`packages/client/src/ui/hud/inventory`)

Parent module: [../../../README.md](../../../README.md)

## Modules

- [`InventoryShell.ts`](InventoryShell.ts) — Modal shell, summary counter, and close controls.
- [`InventoryGrid.ts`](InventoryGrid.ts) — Root workspace (`4` armor slots + quick craft +
  `3×9` backpack + inspector + `1×9` hotbar) and backpack drop target for unequipping.
- [`InventoryHotbarGrid.ts`](InventoryHotbarGrid.ts) — `1×9` active hotbar with drag/drop
  reordering, right-click/`×` return to backpack, and non-sticky click assignment.
- [`InventoryArmorStats.ts`](InventoryArmorStats.ts) — Draggable 4-slot armor grid and
  live level/HP/stamina/DR/hand summary.
- [`InventoryInspector.ts`](InventoryInspector.ts) — Selected item inspector with quick
  Move-to-Hotbar/Backpack, Equip, Use, and Drop actions.
- [`InventoryQuickCraft.ts`](InventoryQuickCraft.ts) — Hand + nearby workbench 1-click recipes.
- [`inventoryDragPayload.ts`](inventoryDragPayload.ts) — Shared structured `DataTransfer`
  payload for backpack, hotbar, and armor drag-and-drop.
