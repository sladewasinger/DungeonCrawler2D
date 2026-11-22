# Combat VFX, Target & Gore Renderer (`render/combat/`)

Client-side visual feedback layers driven by authoritative `@dc2d/engine` `WorldEvent`, `WorldEntitySnapshot`, and `ProjectileSnapshot` streams:

- **Tuning Config (`combatVisualTuning.ts`)**: Single editable config exposing `MELEE_SWING_TUNING` (swing timings, combo arc sweeps/reaches/lunge, progressive smear radii/colors, hitstop durations) and `GORE_TUNING` (decal pool cap, gravity, palettes, splatter/streak/drip/explode physics).
- **Composable Gore (`goreSystem.ts`)**: Pairs `GoreStyle` (`splatter`, `thin-streak`, `drip`, `chunk-spray`, `explode-away`) orthogonally with `GoreSubstance` (`blood`, `slime`, `ichor`, `straw`, `bone`). Launches 2.5D bouncing droplets that stamp elongated smears into a bounded `200`-decal ring buffer (`decalLayer`) fading cleanly over `30–55s`, and ticks ongoing bleed drips for actors with `bleedTimer > 0`.
- **Target & Telegraph Sprites (`entitySprites.ts`)**: Renders the spawn-region Straw Dummy, Slime Target (with semi-transparent regenerating puddle state while reforming), and Armored Sparring Dummy with amber/red directional windup arcs, hit wobble, stagger tint, and damaged HP bars.
- **Combat Juice (`combatVfx.ts`)**: Renders actor-tracked progressive crescent blade smears (`moveTo`-anchored outer rim + tapering fill), rotated charge-streaked arrows, hero overhead bow-draw charge bar, gold parry bursts, block sparks, floating damage/status popups, and a `45–55ms` hitstop freeze feel on impactful hits and parries.
