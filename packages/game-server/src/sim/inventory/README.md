# Inventory & Hotbar Simulation (`packages/game-server/src/sim/inventory`)

Parent architecture: [../../README.md](../../README.md)

## Real-Item Hotbar Invariants

Hotbar slots mirror real owned inventory stacks (no empty/ghost `[0]` favorites):

- [`hotbarSync.ts`](hotbarSync.ts) — `reconcileHotbar`, `pruneDepletedItemFromSlot`,
  `assignHotbarSlot` (atomic move/swap or clear-to-backpack), and
  `restoreOwnedSavedHotbar` on respawn.
- [`inventory.ts`](inventory.ts) — Stack add/remove (`invAdd`, `invRemove`
  automatically prunes depleted items from `slot.hotbar` and `slot.weapon`),
  pickups, drops, crafting, and stash transfers.
- [`armor.ts`](armor.ts) — 4-slot armor loadout (`head`, `chest`, `legs`,
  `boots`) and derived damage reduction, max HP, and move speed scaling.
- [`starterKit.ts`](starterKit.ts) — Fresh-join starter kit, one-time hotbar
  migration, and respawn restoration filtered to actually owned items.
