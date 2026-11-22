# Combat Rules (`@dc2d/engine`)

Pure, deterministic combat math shared between authoritative simulation and client prediction:

- **Tuning Config (`COMBAT_TUNING` in `combatRules.ts`)**: Single shared config object driving sanctuary center/radius, player vitals/stamina regen, combat movement multipliers (`dodge`, `swing`, `block`, `bowDraw`), dodge timings, melee combo scaling, parry/block windows, bow speed/damage, and bleed duration.
- **Sanctuary (`isInSanctuary`)**: Safe spawn campfire glade (`r <= 7.5` tiles around `(0.5, 0.5)`) preventing PvP damage and keeping hostile creatures out.
- **Melee, Bow & Shield (`comboMultiplier`, `evaluateBowShot`, `isWithinSector`, `computeMitigatedDamage`)**: 3-hit combo scaling, hold-to-charge arrow velocity/damage curve, directional attack/block sector hit-testing, dodge-roll stamina/i-frame timings, and defense mitigation.
- **Composable Gore (`GoreStyle` × `GoreSubstance`)**: Orthogonal separation of weapon impact patterns (`splatter`, `thin-streak`, `drip`, `chunk-spray`, `explode-away`) from target tissue palettes (`blood`, `slime`, `ichor`, `straw`, `bone`).
