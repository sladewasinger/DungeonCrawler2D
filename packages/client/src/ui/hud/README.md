# Overworld HUD (`ui/hud/`)

Minimalist, mobile-first HUD adhering cleanly to the 36-slot RPG layout:

- **Public Toolbar (`atmosphereToolbar.ts`, `audioPopover.ts`)**: Top-left bar shows `Bag` and `Hero` by default, gating debug/admin controls (`Server · Day`, `FX`, `Atmosphere ▾`, `Spawn ▾`) behind `?debug=1` or `?admin=1`. Top-right holds the **`CompassBadge`** `(X, Y)` coordinate pill alongside `Audio`, `FS`, and `−`/`+` zoom controls.
- **Bottom Hotbar (`bottomHotbar.ts`)**: Slots `0..8` (with slot `9` holding the `Overworld Map` item) plus the glowing/dimmed built-in **Lantern** toggle icon (`F` shortcut), always visible & droppable at screen bottom (`z-index: 40`).
- **Vitals Strip (`vitalsBar.ts`)**: Compact HP bar, Stamina bar, and subtle spawn `Sanctuary` indicator positioned directly above the bottom hotbar.
- **Inventory Modal (`inventoryModal.ts`)**: Minimalist `[Tab]` / `Bag` modal containing `27`-slot Backpack (`9..35`), `5` Armor/Shield slots (`head`, `chest`, `legs`, `feet`, `offhand`), live Stats (`HP`, `Stamina`, `Defense`, `Held`), and **`Craft`** button.
- **Bidirectional Chest Modal (`chestModal.ts`)**: Opened via `[E]` / `[E] Open Chest` near any POI chest; Minecraft-style `3×9` Chest (`Take All`) beside `3×9` Backpack (`9..35`) + live Bottom Hotbar below (supports pointer drag, `Shift`-click quick transfer, and 2-tap transfer; auto-closes when walking away).
- **Crafting, Hero Creator & Debug Spawner (`craftingPanel.ts`, `characterPanel.ts`, `debugSpawnPopover.ts`)**.
- **Unified Drag & Drop (`slotDragManager.ts`)**: Pointer drag ghost + `elementFromPoint` drop across Chest, Backpack, Armor/Shield, and Bottom Hotbar, plus `Shift`-click & 2-tap mobile fallback.
