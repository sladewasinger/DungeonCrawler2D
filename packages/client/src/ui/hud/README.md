# Overworld HUD (`ui/hud/`)

Minimalist, mobile-first HUD adhering cleanly to the 36-slot RPG layout:

- **Top Toolbar & Settings (`atmosphereToolbar.ts`, `settings/`)**: Top-left displays a compact backpack icon button (with `?debug=1` gating server/FX/Atmosphere/Spawn tools). Top-right displays the toggleable **`FpsCounter`** (off by default on mobile), **`CompassBadge`** `(X, Y)` coordinate pill, and **Settings gear icon** opening the unified `SettingsMenu` (Hero/Respawn/Title Screen, Video/Quality/Gore/Zoom/FPS/Hitbox Debug, Audio sliders, and Mobile Auto-Aim toggle).
- **Bottom Hotbar (`bottomHotbar.ts`)**: Slots `0..8` plus the glowing/dimmed built-in **Lantern** toggle (`F`), compacted flush to bottom on mobile (`z-index: 40`).
- **Vitals (`vitalsBar.ts`)**: Centered HP bar + timed `FED Ns` / `REST Ns` survival buff pills + diegetic Stealth Eye SVG (`CLOSED`/`SLIT`/`OPEN`) & Light Gem + threat state pill (`HIDDEN`/`COVER`/`SHADED`/`EXPOSED`/`ALERT`/`SPOTTED`) + `Sanctuary` indicator above hotbar, paired with a left-edge **vertical Stamina bar** shifting blue → yellow → red as it drains.
- **Inventory Modal (`inventoryModal.ts`)**: Minimalist `[Tab]` / Backpack modal containing `27`-slot Backpack (`9..35`), `5` Armor/Shield slots, live Stats, and **`Craft`**.
- **Bidirectional Chest Modal (`chestModal.ts`)**: Opened via `[E]`, tap-on-chest in range, or `[E] Open Chest`; Minecraft-style `3×9` Chest beside `3×9` Backpack (`9..35`) + live Bottom Hotbar below.
- **Forgiving Drag & Drop (`slotDragManager.ts`)**: Pure drag-and-drop & `Shift`-click quick transfer with nearest-slot gap snapping when dropped near/between cells.
