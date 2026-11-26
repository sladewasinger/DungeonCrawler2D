# Inventory & Crafting Model

Pure, platform-free helpers backing the true minimalist 36-slot RPG inventory:

- **Slots `0..8`**: Always-visible bottom hotbar (`HOTBAR_SLOT_COUNT = 9`).
- **Slots `9..35`**: `3×9` backpack grid (`BACKPACK_SLOT_COUNT = 27`).
- **Armor, Prefixes & Upgrades (`armorOps.ts`, `gearStats.ts`, `upgradeOps.ts`)**: Five equipment slots (`head`, `chest`, `legs`, `feet`, `offhand`) with `armorPrefixes` + `armorUpgrades` (`+1..+3`) preservation, Blacksmith prefix reforging & `+1..+3` upgrading, defense scaling, and `computePlayerGearStats` summing RPG stats and combat perks.
- **Stacking & Drops (`slotModel.ts`)**: Equipable gear/tools (`maxStack = 1`) occupy one slot per item; consumables and materials stack up to `maxStack = 64`. `canInsertSlotItem` gates ground loot magnetism when inventory capacity is full, and `removeFromSlot` handles world drops from slots/chests.
- **Crafting (`crafting.ts`)**: Validates recipe ingredients, campfire proximity, and available result space (including space freed by consuming ingredients).
- **Bidirectional Chests & Sanctuary Stash (`chestOps.ts`, `stashOps.ts`)**: `27`-slot container transfers (`transferChestSlot`, `transferStashSlot`), quick-move, and Take All shared by server and client.
