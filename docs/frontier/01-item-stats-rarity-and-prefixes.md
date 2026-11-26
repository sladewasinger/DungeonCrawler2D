# Spec 01 — Item Stats, Rarity Tiers, Prefixes & Real Engine Stats

> **Touchpoints**:
> `@dc2d/content` (`src/items/rarities.ts`, `src/items/prefixes.ts`, `src/items/frontierWeapons.ts`, `src/items/frontierArmor.ts`, `src/items/frontierMaterials.ts`, `src/items/statResolver.ts`, `src/items/catalog.ts`),
> `@dc2d/engine` (`src/inventory/slotModel.ts`, `src/inventory/armorOps.ts`, `src/inventory/chestOps.ts`, `src/inventory/gearStats.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/worldSim.ts`, `src/sim/combatSim.ts`, `src/sim/combat/playerCombatHits.ts`, `src/sim/survival/persistenceStore.ts`).

---

## 1. Rarity Tiers

Every `ItemDef` carries a base `rarity: ItemRarity`. Rolled prefixes can bump an item's effective rarity upward (capped at `legendary`).

| Rarity | Hex Color | Border / Badge Tint | Chest Weight (Tier I -> IV) | Description |
| --- | --- | --- | --- | --- |
| `common` | `#cbd5e1` | `rgba(203, 213, 225, 0.35)` | High -> Low | Reliable everyday survival & starter gear |
| `uncommon` | `#4ade80` | `rgba(74, 222, 128, 0.65)` | Medium -> High | Refined copper, ranger, and stalker equipment |
| `rare` | `#60a5fa` | `rgba(96, 165, 250, 0.78)` | Rare -> Medium | Specialized frontier blades, heavy armor & elixirs |
| `epic` | `#c084fc` | `rgba(192, 132, 252, 0.85)` | Very Rare -> Medium | Boss-guarded relics, shadowsteel gear, potent perks |
| `legendary` | `#fbbf24` | `rgba(251, 191, 36, 0.95)` | Ultra Rare -> Rare | Mythic frontier artifacts with signature passives |

`bumpRarity(base, steps)` advances `common -> uncommon -> rare -> epic -> legendary`.

---

## 2. Expanded Item Catalog (45+ Items)

### 2.1 Enriched Existing Items
All existing items in `ITEM_CATALOG` gain `rarity` and concise 1–2 sentence `description` plus missing RPG stats:
- `sword` (`uncommon`), `flint-dagger` (`common`, `critChance: 0.12`, `backstabBonus: 0.25`), `wooden-spear` (`common`, `critChance: 0.05`), `iron-greatsword` (`rare`, `critChance: 0.08`, `critMult: 1.75`), `bow` (`common`, `critChance: 0.1`), `axe` (`common`), `pickaxe` (`common`), `wooden-shield` (`common`), `leather-*` (`common`), consumables & materials (`common`, `herb`/`iron-ore`/`copper-ore` `uncommon`).

### 2.2 New Frontier Weapons & Shields
- **Uncommon**: `copper-sword` (`damage: 21`), `copper-spear` (`damage: 19, range: 2.45`), `bandit-cutlass` (`damage: 20, critChance: 0.14, moveSpeedMult: 0.04`), `bog-dagger` (`damage: 14, critChance: 0.16, perk: "poison", perkValue: 4`), `reinforced-shield` (`offhand, defense: 4, blockMitigation: 0.82`).
- **Rare**: `amber-recurve-bow` (`damage: 27, bowDrawSpeedMult: 0.2, critChance: 0.15`), `frost-hatchet` (`axe, damage: 25, staminaCost: 13, critChance: 0.12`), `golem-maul` (`greatsword, damage: 36, staminaCost: 24, critMult: 1.8`), `runic-buckler` (`offhand, defense: 5, blockMitigation: 0.84, perk: "thorns", perkValue: 5`).
- **Epic**: `shadowfang-spear` (`spear, damage: 25, range: 2.55, backstabBonus: 0.45, stealthVisMult: -0.1`), `venom-fang-blade` (`sword, damage: 26, critChance: 0.18, perk: "poison", perkValue: 6`), `aegis-tower-shield` (`offhand, defense: 8, blockMitigation: 0.9, maxHpBonus: 20`).
- **Legendary**: `sunforged-greatsword` (`greatsword, damage: 42, critChance: 0.18, perk: "burn", perkValue: 6`), `bloodmoon-scythe` (`greatsword, damage: 38, critChance: 0.22, perk: "lifesteal", perkValue: 0.15`), `whisperwind-bow` (`bow, damage: 34, critChance: 0.25, bowDrawSpeedMult: 0.35, moveSpeedMult: 0.06`).

### 2.3 Four New Armor Sets (Recolored 3D Paper-Doll Layers)
Each armor piece reuses the baked player armor layers with distinct `ItemVisualLayerSpec.recolorPrimary` and `recolorTrim` hex pigments so every equipped set visibly changes the player sprite in multiplayer:
1. **Moss Stalker** (`uncommon` — olive/moss `#3f6b3a` / `#78a85a`): `moss-stalker-hood`, `moss-stalker-tunic`, `moss-stalker-leggings`, `moss-stalker-boots`. Bonuses: `stealthVisMult` reduction & `backstabBonus`.
2. **Autumn Ranger** (`rare` — burnt amber `#9a4a24` / `#e09b3d`): `autumn-ranger-hood`, `autumn-ranger-tunic`, `autumn-ranger-leggings`, `autumn-ranger-boots`. Bonuses: `moveSpeedMult`, `critChance`, `bowDrawSpeedMult`.
3. **Iron Knight** (`rare` — tempered steel `#64748b` / `#cbd5e1`): `iron-knight-helm`, `iron-knight-cuirass`, `iron-knight-greaves`, `iron-knight-sabatons`. Bonuses: high `defense`, `maxHpBonus`.
4. **Shadowsteel** (`epic` — obsidian violet `#3b2d54` / `#a855f7`): `shadowsteel-cowl`, `shadowsteel-coat`, `shadowsteel-legguards`, `shadowsteel-boots`. Bonuses: high `defense`, `critChance`, `staminaRegenBonus`, `stealthVisMult`.

### 2.4 Frontier Materials & Rare Consumables
- **Materials**: `copper-ingot` (`uncommon`), `iron-ingot` (`uncommon`), `amber-resin` (`uncommon`, Autumn Woods), `bog-spore` (`uncommon`, Misty Bog), `sunstone` (`rare`, Craggy Highlands), `shadow-shard` (`rare`, Cursed Ruinlands), `ancient-core` (`epic`, Elite Lairs / Puzzle Vaults).
- **Consumables / Elixirs**: `swiftness-draught` (`uncommon`, `+22%` move speed for `60s`), `ironbark-tonic` (`rare`, `+25` max HP & `+5` defense for `90s`), `shadow-oil` (`rare`, `-30%` stealth visibility for `75s`), `phoenix-salve` (`epic`, instant `+75 HP` + cures burn/poison/bleed).

---

## 3. Rolled Prefixes (18) & 6 Real Perks

Non-stackable gear (`maxStack === 1`) can carry an optional `prefixId` on `SlotItem` (and `armorPrefixes` when equipped).

| Prefix ID | Display Name | Applies To | Rarity Bump | Stat Modifiers & Perk |
| --- | --- | --- | --- | --- |
| `keen` | Keen | weapon, tool | +1 | `+3 dmg, +8% crit` |
| `vicious` | Vicious | weapon | +1 | `+5 dmg, +0.25x critMult` |
| `swift` | Swift | weapon, tool | +1 | `-15% stamCost, +4% speed` |
| `vampiric` | Vampiric | weapon | +2 | `+2 dmg, Lifesteal (12%)` |
| `blazing` | Blazing | weapon | +2 | `+3 dmg, Burn (5 dmg/s)` |
| `venomous` | Venomous | weapon | +1 | `+2 dmg, Poison (4 dmg/s)` |
| `serrated` | Serrated | weapon | +1 | `+3 dmg, Bleed (4 dmg/s)` |
| `stalwart` | Stalwart | armor, offhand | +1 | `+2 def, +15 Max HP` |
| `shadow-woven` | Shadow-Woven | armor | +1 | `+1 def, -12% visibility, +15% backstab` |
| `fleet` | Fleet | armor | +1 | `+1 def, +7% speed, +3 stam/s` |
| `vital` | Vital | armor, offhand | +1 | `+1 def, +25 Max HP` |
| `thorny` | Thorny | armor, offhand | +2 | `+2 def, Thorns (4 dmg)` |
| `radiant` | Radiant | weapon, armor, offhand | +2 | `+15 Max HP, Glow (+55px light)` |
| `runed` | Runed | weapon, armor | +2 | `+4 dmg, +2 def, +6% crit` |
| `heavy` | Heavy | weapon, armor | 0 | `+4 dmg, +2 def, -3% speed` |
| `lightweight` | Lightweight | weapon, armor | 0 | `+5% speed, +12 Max Stamina` |
| `hunters` | Hunter's | bow, armor | +1 | `+10% crit, +15% bow draw speed` |
| `ancient` | Ancient | weapon, armor, offhand | +2 | `+4 dmg, +2 def, +10% crit, +15 Max HP` |

---

## 4. Real Engine Stat & Perk Wiring

`computePlayerGearStats({ armor, armorPrefixes, heldItem })` in `@dc2d/engine` aggregates all equipped armor (`head`, `chest`, `legs`, `feet`, `offhand`) plus the held `SlotItem`:
- **Vitals (`worldSim.ts`)**: `effectiveMaxHp = 100 + gear.maxHpBonus + wellFedBonus + shrineVigorBonus`; `effectiveMaxStamina = 100 + gear.maxStaminaBonus`; `staminaRegen += gear.staminaRegenBonus`; `moveSpeed *= (1 + gear.moveSpeedMult + shrineSwiftnessBonus)`.
- **Stealth (`worldSim.ts` + `playerCombatHits.ts`)**: `stealthExposure *= clamp(1 + gear.stealthVisMult + shrineShadowBonus, 0.35, 1.35)`; backstab multiplier adds `gear.backstabBonus`.
- **Combat (`playerCombatHits.ts` & `combatSim.ts`)**:
  - **Crit**: Deterministic/tick-seeded crit roll using `gear.critChance` (base `0.05` + gear); crits multiply damage by `gear.critMult` (base `1.5`) and spawn golden crit sparks/hit numbers.
  - **On-Hit Perks**: `bleed` -> sets target `bleedTimer`; `burn` -> sets `burnTimer` & ignites webs/braziers; `poison` -> sets target `poisonTimer`; `lifesteal` -> heals player `Math.round(damage * lifestealRatio)`.
  - **Thorns**: When an enemy hits a player in melee, reflect `gear.thorns` damage back to the attacker!
  - **Glow**: `gear.glowRadius` boosts the player's carried lantern/aura light radius in `lightingSystem.ts` (`glowRadiusBonus`).
- **Prefix Persistence**: `SlotItemSchema` adds `prefixId?: string`, `InventorySnapshotSchema` adds `armorPrefixes?: Record<ArmorSlotKey, string>`, and `PersistedPlayerRecord` saves `armorPrefixes` cleanly (defaulting `{}` for legacy saves).
