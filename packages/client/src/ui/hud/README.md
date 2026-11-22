# Overworld HUD (`ui/hud/`)

Minimalist, mobile-first HUD adhering cleanly to the 36-slot RPG layout:

- **Public Toolbar (`atmosphereToolbar.ts`, `audioPopover.ts`)**: Top-left bar shows only `Bag` and `Hero` by default, gating debug/admin controls (`Server · Day`, `FX`, `Atmosphere ▾`) behind `?debug=1` or `?admin=1`. Top-right holds `Audio` (Music/SFX sliders + Mute popover), `FS`, and `−`/`+` zoom buttons.
- **Bottom Hotbar (`bottomHotbar.ts`)**: Slots `0..8` plus a glowing/dimmed built-in **Lantern** toggle icon (`F` shortcut) right beside slot 9, always visible & droppable at screen bottom (`z-index: 40`).
- **Vitals Strip (`vitalsBar.ts`)**: Compact HP bar, Stamina bar, and subtle spawn `Sanctuary` indicator positioned directly above the bottom hotbar.
- **Inventory Modal (`inventoryModal.ts`)**: Minimalist `[Tab]` / `Bag` modal containing `27`-slot Backpack (`9..35`), `5` Armor slots (`head`, `chest`, `legs`, `feet`, `offhand` Shield), live Stats (`HP`, `Stamina`, `Defense`, `Held`), and a header **`Craft`** button linking straight to Crafting.
- **Crafting Panel (`craftingPanel.ts`)**: Dedicated `[C]` / `Craft` panel showing craftable recipes by default (`Show Locked` toggle `OFF`), plus a header **`Bag`** button back to Inventory.
- **Hero Appearance Creator (`characterPanel.ts`)**: `[H]` / `Hero` modal with live layered preview, auto-saved hero name, body style, skin tone, hair style, and hair color.
- **Unified Drag & Drop (`slotDragManager.ts`)**: Pointer drag ghost + `elementFromPoint` drop across Backpack, Armor/Shield, and Bottom Hotbar, plus 2-tap mobile fallback.
