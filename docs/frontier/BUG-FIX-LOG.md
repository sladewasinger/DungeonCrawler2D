# Frontier RPG — Bug & Spec Audit Fix Log

Live tracker of every bug, usability flaw, and spec gap identified during code audit and local browser playtesting.

---

## 1. Inventory, Chest, Hotbar & Item Card Bugs

### BUG-01 — Dropped Items Boomerang Back Into Inventory While Looting Chests (Severity: CRITICAL)
- **Symptom**: With a full inventory at a chest, dumping items onto the ground to free slots briefly opens space, then the dropped items immediately fly back into the player's bag or leave client/server inventory out of sync so chest items cannot be taken.
- **Root Cause**:
  1. `LootManager.spawnPlayerDrop` (`packages/game-server/src/sim/wildlife/lootManager.ts`) spawned dropped items only `0.7` tiles away — right inside the `2.4`-tile `lootMagnetRadiusTiles` — with only a `1.8s` delay, sucking them right back in while standing still at a chest.
  2. `applyServerSnapshotMessage` (`packages/client/src/net/socket/worldClientSocket.ts`) only cleared `gates.inv` inside `if (msg.selfInventory)`. When a full-bag chest take succeeded as a server no-op (inventory unchanged), `selfInventory` was omitted, leaving `gates.inv` stuck pending for `1500ms`.
  3. `ChestModal` / `WorldClient` returned `void` on `chestTransfer` and `chestTakeAll` with zero `"Inventory Full!"` feedback, and `resolveCrossContainerSlot` (`slotDropResolver.ts`) refused to swap onto occupied slots when the destination bag was full.
- **Fix**:
  - Added `droppedByPlayerId` + `dropLockActive` in `LootManager`: dropped items push slightly farther (`1.05` tiles, `3.0` velocity) and **never auto-magnet back** to the dropper until that player moves `>= 3.2` tiles away (or `120s` fallback timeout, or explicit `[E]` / ground-click manual pickup).
  - Updated `worldClientSocket.ts` to always run `resolvePendingGate(t.gates.inv, ...)` on `serverAck` even when `msg.selfInventory` is omitted.
  - Updated `applyChestTransfer` / `applyChestTakeAll` (`clientInventory.ts`) and `WorldClient` to return `changed: boolean`, show an `"Inventory Full!"` toast/pill in `ChestModal`, and allow direct full-bag drag-swaps onto occupied slots in `slotDropResolver.ts`.
  - Updated `ChestModal` header titles from hardcoded `"Ancient Coffer" / "Bandit Chest"` to `getPoiCatalogEntry(poiKind).displayName` (or `"Storage Chest"` for player-placed chests).
- **Status**: `VERIFIED LIVE` — Pass 1 confirmed `"Inventory Full — drop or swap an item"` banner, direct full-bag chest->occupied-slot drag-swap, and dropped items staying on the ground for 2.6s+ without boomeranging back while freeing chest items to `Take` cleanly; unit tests cover `clientInventory` and `slotDropResolver`.

### BUG-02 — Tapping Hotbar Slots Opens Item Card Unwantedly (Severity: HIGH)
- **Symptom**: Clicking a hotbar slot (`1`–`9`) during active gameplay popped `.ow-item-card` right over the center of the screen instead of simply selecting the weapon/tool. Meanwhile, hovering over slots with a mouse showed no stats preview.
- **Root Cause**: `SlotDragManager.handleUp` (`packages/client/src/ui/hud/slotDragManager.ts`) unconditionally called `onInspectItem(tracker.source)` whenever `!tracker.dragging && tracker.itemId`, ignoring whether Inventory/Chest was open.
- **Fix**:
  - Track `panelOpen` in `SlotDragManager`. Clicking/tapping a hotbar slot during gameplay **only** selects the hotbar slot.
  - Clicking/tapping any filled slot **while Inventory or Chest is open** opens the pinned interactive Item Card (clicking the same slot again toggles it closed; clicking an empty slot dismisses it).
  - Added non-blocking desktop mouse hover preview (`mode: "hover"`, `pointer-events: none`, 120ms initial delay) so hovering any hotbar/bag/armor/chest slot shows its full Item Card without stealing clicks.
- **Status**: `VERIFIED LIVE` — Pass 1 confirmed clicking hotbar slots only switched selection (`0` Item Card opens), hovering opened non-blocking `mode="hover"`, and clicking slots inside Inventory/Chest toggled `mode="pinned"`.

### BUG-03 — 120 FPS DOM Thrashing Breaks Item Card Buttons (Severity: CRITICAL)
- **Symptom**: Clicking `Close`, `Equip`, `Use`, or `Drop` on `.ow-item-card` failed silently (reproduced 100% of the time in Step 8 & Step 10 of live browser playtest).
- **Root Cause**: `HudRoot.sync` called `itemCard.sync(...)` every `requestAnimationFrame` (~120Hz), and `ItemCardPopover.sync` lacked a fingerprint guard — calling `this.el.replaceChildren(...)` every ~8ms and destroying buttons between `pointerdown`/`mouseup`/`click`.
- **Fix**:
  - Added strict `lastRenderKey` caching in `ItemCardPopover.sync()` so DOM rebuilds only happen when mode, source, item, comparison item, chest state, or anchor changes.
  - Added missing **`Take`** (chest slot -> bag) and **`Store`** (bag slot -> open chest) action buttons, plus smart viewport-clamped positioning beside slots on desktop instead of always sitting dead-center over the grid.
  - Added right-click quick transfer on chest/inventory slots when a chest is open.
  - Fixed `SlotDragManager.slotItemFor` for armor slots so `prefixId` is preserved during hover/drag/inspection.
- **Status**: `VERIFIED LIVE` — Pass 1 confirmed first-click `Close`, `Equip`, `Take`, right-click transfer, and `Take All` all work reliably.

### BUG-04 — Proximity Chat Feed Silently Drained & Overhead Speech Bubble Dropped on Local Player (Severity: HIGH)
- **Symptom**: Sending chat messages (`/god on`, `"Frontier Chat Works!"`, `"!Hear me!"`) broadcast from the server, yet `.ow-chat-feed` stayed empty and no speech bubble appeared over the local player's head (caught in Pass 1).
- **Root Cause**:
  1. `renderTick` (`packages/client/src/main.ts`) called `const pre = ctx.client.snapshot()` before `stepInput()` and `const view = ctx.client.snapshot()` after. Calling `snapshot()` drained `this.queuedChat = []` into `pre.chatMessages`, which was then discarded because `syncUiAndAudio` only read `view.chatMessages`.
  2. `serverCombatFields(serverMe)` (`packages/client/src/net/worldPrediction.ts`) omitted `activeBubble: serverMe.activeBubble`, so `reconcilePredictedPlayer` dropped incoming server speech bubbles when reconciling within `gap <= 0.75`.
- **Fix**:
  - Merged `frameChat = [...(pre.chatMessages ?? []), ...(view.chatMessages ?? [])]` in `main.ts` and forwarded `frameChat` into `syncUiAndAudio`.
  - Added `activeBubble: serverMe.activeBubble` to `serverCombatFields` in `worldPrediction.ts`.
  - Added unit test in `packages/client/src/net/clientInventory.test.ts` verifying `reconcilePredictedPlayer` propagates and clears `activeBubble`.
- **Status**: `VERIFIED LIVE` — Pass 2 confirmed `[Admin]` replies, normal proximity chat `"Frontier Chat Works!"`, and gold shout `"!Hear me!"` all appear in `.ow-chat-feed` AND render crisp speech/shout bubbles directly above `Adventurer`'s head.

### BUG-05 — Lit Brazier Sprites Stayed Grey/Unlit After Ignition (Severity: HIGH)
- **Symptom**: Igniting braziers at a Sealed Brazier Vault unsealed the vault chest, yet the brazier sprites remained grey `BrazierUnlit` pedestals (caught in Pass 1).
- **Root Cause**: `brazierIdForPoi` (`packages/engine/src/world/pois/frontierPoiLayouts.ts`) formats brazier IDs as `brazier:<poiKind>:<cx>,<cy>:<idx>`. `keyFromBrazierId` (`packages/engine/src/survival/worldDeltas.ts`) read `brazierId.split(":")[1]` (`<poiKind>`) instead of `<cx>,<cy>`, so `replaceFromSnapshot` never bumped `chunkRevs` or evicted the stale cached chunk on the client.
- **Fix**:
  - Updated `keyFromBrazierId` with `parseChunkCoordToken` to scan `brazierId.split(":").slice(1)` for the `cx,cy` coordinate token.
  - Added unit test in `packages/engine/src/survival/survivalRules.test.ts` verifying `replaceFromSnapshot({ litBraziers })` bumps `chunkRevision` and replaces `PropKind.BrazierUnlit` with `PropKind.BrazierLit` + point light.
- **Status**: `VERIFIED LIVE` — Pass 2 screenshot (`final_step_73.png`) confirmed stone braziers render bright orange glowing flames and embers, and `[E]` opens the unlocked vault chest.

---

## 2. Frontier RPG Spec Gaps (`docs/frontier/01`–`07`)

### GAP-01 — `[E]` Interaction Broken for Shrines, Waystones, Lore Signs, Braziers & Beds (Severity: CRITICAL)
- **Symptom**: Pressing `[E]` near a Shrine, Waystone, Lore Sign, Brazier Vault, or Camp Bed did nothing when no open chest was nearby.
- **Root Cause**: `InputController.handleShortcut` (`KeyE`) checked `if (!callbacks.onInteract) this.interactQueued = true; callbacks.onInteract?.();`. Because `main.ts` provided `onInteract`, `interactQueued` was **never** set, starving `CombatWorld.handleInteract` / `PoiInteractionManager`. Also, `WorldPickupsRenderer` only showed `[E]` prompts for chests & arrows, and sealed vault chests had no visual seal ring or brazier progress indicator.
- **Fix**:
  - `handleWorldInteract` now returns `boolean`; whenever no unsealed chest modal/loot pickup handled `[E]`, `input.queueInteract()` fires so server POI/brazier/bed interaction executes.
  - Added sealed-vault toast + brazier progress prompt (`Sealed Vault (lit/total Braziers)`), arcane seal ring on sealed chests, and contextual `[E]` HUD prompts for Shrines, Waystones, Braziers, Lore Signs, and dropped items.
  - Marked server persistence dirty when a player discovers a new POI (`DiscoveryTracker` dirty tracking).
- **Status**: `VERIFIED LIVE` — Pass 1 & Pass 2 confirmed `[E]` Wind Shrine (`SWIFTNESS 180s`), Ancient Waystone (`10/19`), and Brazier Vault ignition + chest unlock.

### GAP-02 — Frontier Bows & Shields Non-Functional Due to Hardcoded Starter IDs (Severity: CRITICAL)
- **Symptom**: `amber-recurve-bow` and `whisperwind-bow` could not draw or shoot arrows; `reinforced-shield`, `runic-buckler`, and `aegis-tower-shield` could not block, parry, or render shield visuals.
- **Root Cause**: `heldItem === "bow"` and `offhand === "wooden-shield"` were hardcoded across `main.ts`, `controller.ts`, `mobileCombatControls.ts`, `worldClientSocket.ts`, `playerSprite.ts`, `playerPoseHelpers.ts`, `playerHeldLayout.ts`, `combatShapes.ts`, and `combatSimHelpers.ts`.
- **Fix**: Added canonical `isBowItem()` & `isShieldItem()` helpers in `@dc2d/content` and replaced every hardcoded starter ID check across client, engine, and server.
- **Status**: `VERIFIED LIVE` — Pass 1 confirmed `amber-recurve-bow` drawing & firing arrows (`33 -> 32`), `sunforged-greatsword` parry, and `reinforced-shield` blocking.

### GAP-03 — 14 Frontier Weapons Fell Back to Generic Upright Idle Icon + Missing Shield Variants (Severity: HIGH)
- **Symptom**: Holding new frontier weapons (`sunforged-greatsword`, `bloodmoon-scythe`, `bog-dagger`, `shadowfang-spear`, `amber-recurve-bow`, etc.) used generic upright icon fallback with no grip hands, no two-handed greatsword stance, no bow draw pose, and all shields used the wooden shield sprite.
- **Fix**: Added procedural crisp-outlined sprites & proper 1H/2H/bow grip specs in `frontierHeldGear.ts`, plus distinct `reinforced-shield`, `runic-buckler`, and `aegis-tower-shield` visuals and tinted 3D bow draw overlays.
- **Status**: `VERIFIED LIVE` — Pass 1 screenshots confirmed distinct bow draw sprites, greatsword 2H pose, and `reinforced-shield` visuals.

### GAP-04 — 3D Armor Layer Recoloring Never Wired (Severity: HIGH)
- **Symptom**: Equipping `moss-stalker`, `autumn-ranger`, `iron-knight`, or `shadowsteel` armor still rendered starter brown leather on the player sprite and Hero Creator portrait.
- **Root Cause**: `ItemVisualLayerSpec` defined `recolorPrimary`/`recolorTrim`, but `resolveLayerStack` (`playerPortraitBake.ts`) stripped styles down to asset ID strings, and `playerCompositor.ts` drew raw un-recolored leather WebP layers.
- **Fix**: Implemented luminance-preserving primary + trim pixel recoloring (`armorLayerRecolor.ts`) and wired `resolveStyledLayerStack` through both `playerCompositor.ts` and `build3dCharacterPortraitUrl`.
- **Status**: `VERIFIED LIVE` — Pass 1 screenshot confirmed green Moss Stalker armor rendering cleanly on the player sprite.

### GAP-05 — `[M]` Overworld Map Dropped FPS from 120 to 14 FPS (Severity: HIGH)
- **Observation from Live Playtest (Step 140)**: Opening the Overworld Map tanked frame rate to ~14 FPS and latency to ~42 ms.
- **Root Cause**: `drawFrontierMapPins` (`mapPinRenderer.ts`) iterated up to 121 chunks and invoked `ctx.getContext("2d")` / `drawImage` / full pin loops every single animation frame (~120Hz).
- **Fix**: Memoized scanned POI pins per `(worldSeed, pcx, pcy, halfChunks)` window and throttled `MinimapOverlay` full canvas composites while keeping player/entity updates responsive.
- **Status**: `VERIFIED LIVE` — Pass 1 confirmed `[M]` Overworld Map stays at `118 FPS` with `?` waystone beacons and POI pins.

### GAP-06 — Missing Vitals Buff Pill, Unlit Radiant Glow & Admin Playtest Commands (Severity: MEDIUM)
- **Issues**:
  1. `VitalsBar` never rendered `player.shrineBuff` (`SWIFT`, `VIGOR`, `SHADOW` timers from shrines/elixirs).
  2. Radiant `glowRadiusBonus` only worked when the lantern was lit (`!player.torchLit` returned early).
  3. No server-side admin slash commands (`/god`, `/give`, `/fillbag`, `/biome`, `/poi`, `/tp`) existed for chat-driven dev/playtesting when `window.admin` isn't accessible in sandboxed Playwright contexts.
- **Fix**: Add `shrineBuff` pill in `VitalsBar`, emit radiant light from `glowRadiusBonus` even with lantern toggled off, broadcast `chat` messages immediately without tick lag, and add admin-only slash commands gated strictly by `session.isAdmin`.
- **Status**: `VERIFIED LIVE` — Pass 1 & Pass 2 confirmed `SWIFTNESS 60s`/`180s` vitals pill, radiant glow, immediate chat/admin slash replies, and 5-biome travel (`/biome`).
