# Inventory & Crafting Model

Pure, platform-free helpers backing the true minimalist 36-slot RPG inventory:

- **Slots `0..8`**: Always-visible bottom hotbar (`HOTBAR_SLOT_COUNT = 9`).
- **Slots `9..35`**: `3×9` backpack grid (`BACKPACK_SLOT_COUNT = 27`).
- **Armor (`armorOps.ts`)**: Four dedicated equipment slots (`head`, `chest`, `legs`, `feet`) with rule-validated swapping and total defense calculation.
- **Stacking (`slotModel.ts`)**: Equipable gear (`maxStack = 1`) occupies one slot per item and never combines stack counts; consumables and materials stack up to `maxStack`.
- **Crafting (`crafting.ts`)**: Validates recipe ingredients, campfire proximity, and available result space (including space freed by consuming ingredients).
- **Bidirectional Chests (`chestOps.ts`)**: `CHEST_SLOT_COUNT = 27` container slot transfer (`transferChestSlot`), quick-move (`quickTransferChestSlot`), and `takeAllFromChest` shared by server and client.
