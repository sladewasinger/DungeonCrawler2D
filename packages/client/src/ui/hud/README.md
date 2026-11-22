# Phase 2 HUD (`ui/hud/`)

Minimalist, mobile-first HUD adhering cleanly to the 36-slot RPG layout:

- **Bottom Hotbar (`bottomHotbar.ts`)**: Slots `0..8`, larger touch-friendly sizing (`--ow-slot-size`), always visible & droppable at screen bottom (`z-index: 40`), never duplicated inside modals, zero green equipped highlights.
- **Inventory Modal (`inventoryModal.ts`)**: Minimalist `[Tab]` / `Bag` modal containing strictly `27`-slot Backpack (`9..35`), `4` Armor slots (`head`, `chest`, `legs`, `feet`), and Stats (`HP`, `Stamina`, `Defense`, `Held`).
- **Crafting Panel (`craftingPanel.ts`)**: Dedicated `[C]` / `Craft` panel showing craftable recipes by default with an optional `"Show Locked"` toggle (`OFF` by default).
- **Unified Drag & Drop (`slotDragManager.ts`)**: Pointer drag ghost + `elementFromPoint` drop across Backpack, Armor, and Bottom Hotbar, plus 2-tap mobile fallback.
