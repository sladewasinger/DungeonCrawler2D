# Spec 02 — Tap/Click Item Card & Inspection UI

> **Touchpoints**:
> `@dc2d/client` (`src/ui/hud/slotDragManager.ts`, `src/ui/hud/slotRenderer.ts`, `src/ui/hud/hudRoot.ts`, `src/ui/hud/itemCard/itemCardPopover.ts`, `src/ui/hud/itemCard/itemCardCompare.ts`, `src/ui/hud/itemCard/itemCardStyles.ts`, `src/ui/icons/frontierItemIcons.ts`).

---

## 1. Player Experience & Interaction Rules

Players must be able to inspect any item effortlessly on both phone and desktop **without** breaking drag-and-drop:

1. **Tap / Click to Inspect**: In `SlotDragManager.handleUp`, when `!tracker.dragging && tracker.itemId`, fire `actions.onInspectItem(tracker.source)`.
   - Touch drag threshold remains `14px`; mouse drag threshold remains `6px`.
   - `Shift + Left-Click` while a chest is open still performs instant quick transfer as before.
   - Dragging an item still moves/swaps/equips/drops cleanly and closes any open Item Card.
2. **Dismissal**: Clicking outside the card, pressing `Escape`, closing the parent panel, or starting a drag closes the Item Card immediately.
3. **Rarity Visuals on Slots**: Every occupied inventory, hotbar, armor, chest, and crafting icon slot tints its border and subtle inner corner gleam to match the resolved rarity (`uncommon` green, `rare` blue, `epic` purple, `legendary` gold). `slotsFingerprint` includes `prefixId` so slot visuals update immediately when items change.

---

## 2. Item Card Layout & Stat Comparison

The `ItemCardPopover` renders as a clean floating dark-slate RPG card centered over the HUD (clamped safely within mobile portrait/landscape viewports):

- **Header**:
  - `64×64` crisp `image-rendering: pixelated` item icon inside a rarity-glowing frame.
  - Full resolved title (`[Prefix] Base Name`) colored by rarity tier.
  - Subtitle pill: `Rarity · Category / Slot` (e.g., `Epic · Two-Handed Weapon` or `Rare · Chest Armor`).
- **Lore Blurb**: 1–2 crisp sentences from `ItemDef.description`.
- **Stats & Equip Comparison Grid** (`itemCardCompare.ts`):
  - Displays all non-zero stats (`Damage`, `Defense`, `Block`, `Crit Chance`, `Crit Mult`, `Range`, `Stamina Cost`, `Max HP`, `Max Stamina`, `Stamina Regen`, `Move Speed`, `Stealth`, `Backstab`, `Heal HP`, `Well-Fed`).
  - When inspecting an equippable item in the backpack/chest/hotbar, compares each stat against the **currently equipped item** in the matching armor slot (or currently selected hotbar weapon for weapons) and renders inline green `(+4)` or red `(-2)` comparison deltas!
- **Perks & Buffs**: Highlighted pill chips explaining active perks (e.g., `✦ Lifesteal: Restores 12% of damage dealt`, `✦ Thorns: Reflects 4 melee damage`) or consumable buffs (`+22% Move Speed for 60s`).
- **Action Footer**:
  - Armor / Shield in backpack/hotbar -> **`Equip`** button (or **`Unequip`** when inspecting an equipped armor slot).
  - Weapon / Tool / Placeable in backpack -> **`Move to Hotbar`** (if space) or **`Select`** if already on hotbar.
  - Consumable (`healHp` / `buffEffect`) -> **`Use`** button (consumes/activates item directly).
  - Any non-empty slot -> **`Drop`** button + **`Close` (`✕`)**.

---

## 3. Acceptance Criteria

- Tapping any item in Hotbar, Backpack, Armor, or Chest opens the Item Card without moving or dropping the item.
- Dragging any item across slots or out of the HUD still works identically with zero accidental popups.
- Stat comparisons accurately show green/red deltas against the currently equipped piece (including prefix bonuses).
- Clicking `Equip`, `Unequip`, `Use`, or `Drop` sends the authoritative action and updates/closes the card cleanly.
