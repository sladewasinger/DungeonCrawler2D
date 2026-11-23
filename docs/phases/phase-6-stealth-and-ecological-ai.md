# Phase 6 — Full Stealth RPG, Gradual Perception & Ecological AI Overhaul

> **Status**: 🚧 Pass 1 Landed (`e414691a`) — **Pass 2 Spec & Completion Pending**
> **Primary Touchpoints**:
> `@dc2d/engine` (`src/combat/stealthRules.ts`, `src/combat/aiSensing.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/combatSim.ts`, `src/sim/wildlife/creatureAi.ts`, `src/sim/wildlife/creatureBehaviors.ts`, `src/sim/wildlife/wolfPackAi.ts`, `src/sim/wildlife/worldEcology.ts`),
> `@dc2d/client` (`src/input/controller.ts`, `src/input/mobileCombatControls.ts`, `src/render/world/playerSprite.ts`, `src/render/combat/aiStateIndicators.ts`, `src/ui/hud/vitalsBar.ts`, `src/audio/`)

---

## 1. Player Fantasy & Story Walkthrough

It is late dusk in the whispering forest outside Sanctuary. Instead of charging headlong into a Bandit Camp lit by a crackling hearth, the player switches off their carried Torch and drops into a low **Crouch/Sneak** (`X` on keyboard, glowing `SNEAK` toggle on mobile). Their hero visibly lowers into a cautious stalker stance, footsteps softening into quiet muffled rustles as they slip behind a tall cluster of fern bushes. In the HUD, a closed-lidded **Stealth Eye** narrows into a dim ember gem reading **24% — COVERED**, confirming the canopy shadow and bush cover mask their silhouette from the torchlight.

Twenty paces ahead, an Orc brute and two Goblin sentries patrol near a campfire. The player aims slightly west of a mossy boulder and taps `Q` (or drags/taps the `TOSS` pebble action on mobile): a small stone arcs through the air with a faint shadow, strikes the dirt beside a pine trunk with a sharp *clack*, and blooms a visible expanding noise ripple. A Goblin sentry perks up—its overhead **`?` gauge steadily fills amber** as it hears the impact, then walks over to the pine trunk and sweeps its gaze left and right. Waiting until the sentry turns away, the player creeps directly behind its shoulders. A crisp golden **Backstab Reticle** glints softly at the goblin's spine; one swift slash triggers a heavy **2.25× Backstab Critical**, a sharp hitstop sting, a bold **`BACKSTAB!`** popup, and a clean takedown before the Orc by the fire ever turns around.

Deeper in the wilds, creatures behave like a living ecosystem rather than tether-bound mannequins:
- Spotting a lone Timber Wolf at sunset, if you fail to drop it quietly, it throws its head back in a visible **0.65s Howl**—emitting a pale sound-ring and bone-chilling howl—before three unseen packmates across the ridge burst into motion, circling wide in staggered flanks and nipping at your exposed back while darting away if you wheel to face them.
- Cresting a stony clearing too fast brings a Grizzly Bear onto its hind legs in a roaring **Territorial Bluff**; stepping backward patiently past its comfort boundary calms the bear down so you can pass unharmed—or leave a piece of raw meat to watch it trot over and feed.
- Baiting a charging Wild Boar in front of an oak tree or boulder sends it slamming headfirst into solid cover with a skull-rattling thud, orbiting **dizzy stars**, and a wide **1.5s Stun Window** ready for punishment.
- Creeping under shadowed pines at night demands sharp eyes: concealed Ambush Spiders glint briefly in the dark and spring outward in a fast **parabolic leap**, rather than meekly hopping vertically in place.

---

## 2. Pass-1 Audit (What Exists vs What Is Half-Baked)

| Area | What Exists in Pass 1 (`e414691a`) | Pass-2 Gaps to Fix |
| :--- | :--- | :--- |
| **Crouch & Movement** | `STEALTH_TUNING` (`crouchSpeedMult = 0.56`, noise `0.75`), `X` toggle on PC, `SNEAK` button on mobile, auto-uncrouch on attack/dodge/sprint. | `playerSprite.ts` merely scales Y by `0.88` (squashed sprite!) instead of a dedicated sneak posture/stride, footsteps in `audioEngine` aren't muffled when crouching, and there is no hold-to-crouch option. |
| **Light & Cover Meter** | `sampleStealthExposure` computes `lightLevel`, `inCover` (`Bush`/`TallGrass` within `1.25` tiles), and `visibility` (`0.12..1.0`). | `vitalsBar.ts` only shows a temporary text pill (`COVERED 24%`) that hides (`hidden = !v.stealth`) whenever standing. Missing a real diegetic Eye + Light Gem gauge, tree-canopy shade factor, and leaf/shadow visual tint on hero. |
| **Thrown Pebbles** | Pressing `Q` or using held `stone` calls `CombatWorld.throwPebble`, immediately spawning a `distract` event (`radius: 9.0`) along `aimX/aimY`. | No flying projectile arc/shadow, no surface-aware landing sound (*clack*/*thud*/*plop*), tiny static yellow rings instead of clear expanding noise ripples, and ambiguous UX between infinite free `Q` pebbles vs `stone` stack consumption. |
| **Gradual Perception** | `canPerceiveTarget` checks effective vision & hear radius + elevation LOS; `spottedPopTimer` prevents stuck `!`. | Perception is **binary** (instant spot vs zero awareness). The overhead `?` only appears *after* already entering `investigate`, never fills smoothly as suspicion builds, and guards don't inspect corpses or raise nearby camp allies. |
| **Silent Takedowns** | `isBackstabAngle` (`dot < -0.2`) grants `2.25×` (`3.0×` dagger) melee multiplier and emits `backstab` event (`BACKSTAB!` text). | No backstab-ready visual cue on valid behind targets, no stealth-bow **Ambush Shot** bonus, and weak audiovisual punch (`handleFeedbackEvent` reuses generic gold star burst with no dedicated hitstop/crit chime). |
| **Wolf Hive-Mind** | `wolfPackAi.ts` rallies wolves within `18` tiles (`rallyWolfPack`), puts packmates in staggered orbit slots, darts when behind facing. | No visible **Howl** windup/animation/ring before pack rallies, wolves charge blindly through roaring campfires/torches, and lone surviving wolves never lose morale or flee below critical HP. |
| **Creature Ecology & Targeting** | `stepBearBluff`, `stepBearScavenge`, `stunBoarOnWall`, `stepSpiderAmbushCheck`, `computeSlimeCohesion`. | Only players are valid targets (wildlife never fights bandits or other wildlife); arrow hits don't wake/send creatures searching along shot trajectory; Bear/Golem/enemies never notice camp fights/corpses reliably; all creatures lack diagonal **8-direction** movement sprites (`se`/`ne`); doorway fence posts/campfires can blind guards; dropped loot renders as cryptic `4×4` colored squares and arrows auto-vacuum magnetically. |

---

## 3. Full Stealth System Requirements

### 3.1 Crouch Posture, Keybinds & Controls
- **Visual Sneak Posture (`Hero_Crouch` / Blended Sneak Stance)**:
  - Replace the crude `scaleY = 0.88` squash hack in `packages/client/src/render/world/playerSprite.ts`.
  - Add a Blender-baked `Hero_Crouch` (`crouch_idle` 2-frame + `crouch_walk` 6-frame hunched stalker loop) or lowered stealth knee-bend posture exported through the 16-layer rig pipeline (`player_actions.py` + `export_player_layers.py` + `bakePlayerAssets.mjs`) so all bare/armored bodies, sleeves, capes, and hairs bend naturally at reduced silhouette height.
  - While `inCover` inside `Bush` or `TallGrass`, render a subtle soft foliage-dappled alpha (`0.62` local, near-invisible to distant monsters) plus tiny fluttering leaf motes when creeping through brush.
- **Desktop Controls**:
  - `X` toggles Crouch/Sneak on/off; add optional `C` (Hold-to-Crouch) toggleable preference in Settings (`"Crouch Mode: Toggle [X] / Hold [C]"`), both normalized to boolean `crouch` on wire input.
  - Attacking, dodging (`Space`/`Shift`-roll), sprinting (`Shift` + move), or jumping clears `crouch` cleanly (`shouldCancelCrouch`).
  - Pressing `F` or clicking the Torch/Stealth lantern quick-toggle button smoothly extinguishes/lights the carried Torch without needing to swap hotbar slots.
- **Mobile Controls**:
  - Keep `SNEAK` thumb button in `MobileCombatControls` (`packages/client/src/input/mobileCombatControls.ts`) with unambiguous lit stealth-green active ring + subtle haptic tap where supported.
  - Add a small quick **`TORCH` on/off toggle chip** or tap-badge when a torch/lantern is equipped so mobile players can kill their light before sneaking without hunting their hotbar.

### 3.2 Dynamic Light-Level, Cover & Canopy Exposure (`sampleStealthExposure`)
- Expand `StealthQuery` & `sampleStealthExposure` (`packages/engine/src/combat/stealthRules.ts`):
  - **Ambient Day/Night Curve**: Bright daylight (`0.95..1.0`) drops steeply at dusk/night (`0.14..0.28`), making torch management meaningful once the sun sets.
  - **Tree Canopy Shade**: Standing under an un-felled `OakTree` or `PineTree` crown (`dist <= 1.6` tiles) reduces effective `lightLevel` by `-0.18` during daylight (down to floor `0.38`), letting stealth players stalk from grove shadows even at noon!
  - **Active Light Sources**:
    - Carried `torchLit`: `+0.55` `lightLevel` (impossible to stay hidden right beside guards with a blazing torch).
    - Nearby active `PropKind.Campfire` (`<= 6.5` tiles) or `PropKind.Torch` (`<= 4.2` tiles): radial warm falloff up to `+0.55` / `+0.40`, plus players casting spell/torch swings temporarily flash illumination for `0.6s`.
  - **Concealment (`inCover`)**: `Bush` or `TallGrass` within `1.25` tiles grants `inCover: true`, multiplying detection visibility by `0.42×` while crouched (`0.76×` while upright).
- **Persistent Diegetic HUD Stealth Eye & Light Gem (`vitalsBar.ts`)**:
  - Replace the ephemeral disappearing text badge with a crisp **Stealth Eye / Light Gem Widget** docked neatly beside the HP bar whenever the player is **crouched**, **in brush cover**, or **carrying active threat / suspicion (`nearbyAlert > 0`)**:
    - **Closed Lid + Deep Shadow Blue Gem (`0–35%` Hidden)**: Safely masked.
    - **Half-Slit Lid + Dim Amber Gem (`36–68%` Shaded)**: Detectable at medium-close range or front cone.
    - **Wide-Open Eye + Bright Orange/Crimson Gem (`69–100%` Exposed / Detected)**: Clearly visible to nearby creatures.
  - Include compact icon pips underneath (`Brush` icon when `inCover`, `Flame` icon when lit by fire/torch) instead of verbose strings on mobile.

### 3.3 Noise Propagation & Expandable Sound Ripples
- **Surface-Aware Noise Radius**:
  - Standing still: `0.4` tiles.
  - Crouching in grass/dirt: `0.75` tiles (`Bush`/`TallGrass` whisper).
  - Crouching in shallow water: `1.8` tiles (water always betrays hurried wading!).
  - Walking upright: `3.0` tiles (`4.2` tiles in shallow water).
  - Sprinting: `6.5` tiles (`8.0` tiles in shallow water).
  - Melee swing / Bow release: `9.5` tiles (`3.2` tiles if crouched Bow Ambush release; silenced slightly by crouch).
- **Client Footstep Audio & Visual Ripples**:
  - `audioEngine` / `synthSfx` multiplies local & remote player footstep gain by `0.38×` and softens filter cutoff when `player.crouching === true`.
  - Render faint soft-cyan/ivory concentric floor ripples for loud player noises (`sprint`, `water wade`, `pebble impact`, `howl`) so players have immediate causal feedback on why a guard turned around.

### 3.4 Aimed Pebble / Rock Distraction (`Q` & `stone`)
- **Clear Rule for Availability**:
  - **`Q` (PC) / Pebble Quick-Toss or `stone` slot (Mobile)**: Always allows tossing an ambient pebble for free on a `1.8s` cooldown (`pebbleRangeTiles = 4.5`, `pebbleNoiseRadiusTiles = 8.5`). If the player equips and throws an actual `stone` item (`heldItem === "stone"`), it consumes 1 `stone` for a heavier **Heavy Rock Toss** (`range = 7.0` tiles, `noiseRadius = 12.0` tiles, dealing `4` chip damage if hitting a target!).
- **Real Projectile Arc & Landing**:
  - Replace the instant teleport `distract` event with a short fast parabolic `SimProjectile` (`kind: "pebble"`, `flightSec = 0.22..0.38s` scaled by throw distance) showing a tiny rotating grey stone + ground shadow.
  - Clamp target at blocking walls/cliffs (`elevation > p.elevation`) or prop colliders (`Boulder`, `OakTree`, `Palisade`).
  - Upon impact: emit `distract` noise ripple + expanding ring graphic, surface-specific landing SFX (stone clack on cliffs/ruins, muted grass thump, water plop + splash ring on rivers), and alert all unaware/suspicious creatures within `noiseRadius`.

### 3.5 Silent Takedowns (`BACKSTAB!` & `AMBUSH!`)
- **Melee Backstab**:
  - Eligible when target is unaware or only `investigate`/`alert` (not actively locked in `chase` facing you), `isBackstabAngle` (`dot < -0.2`), and player attacks with any melee weapon.
  - Multipliers: `2.25×` base (`sword`, `spear`, `greatsword`), `2.0×` (`axe`, `pickaxe`), `3.0×` (`dagger`).
- **Bow Ambush Critical**:
  - Firing an arrow (`bowCharge >= 0.45`) while crouched OR from `visibility <= 0.45` (`HIDDEN`/`COVERED`) at an unaware/investigating target triggers an **Ambush Shot** (`1.65×` damage, `AMBUSH!` floating callout, piercing *thwack* chime).
- **Pre-Strike Affordance**:
  - When crouched within `range * 1.15` behind an eligible unaware enemy, show a subtle golden diamond/dagger pip above or behind the enemy so the player knows *before* pressing Attack that they are in backstab position.
- **Strike Payoff**:
  - Trigger `hitstop = 65ms`, dedicated crisp backstab blade-crit SFX (`synthWeaponSfx`), directional gold+crimson spark spray, and rising `BACKSTAB! -40` floating popup.

### 3.6 Doorway / Campfire Line-of-Sight & Arrow Recovery Physics
- **Campfire & Palisade Doorway LOS Fix (`aiSensing.ts`)**:
  - `Campfire` and `Torch` props **never block vision** (gazing past campfires into lit clearings works cleanly).
  - Tighten `Palisade` and `Boulder` LOS occlusion radii to `<= Math.min(0.24, radius * 0.50)` and ensure close-range direct frontal gaze (`<= 2.8` tiles, clear visibility, unobstructed tile elevation) is never blinded by adjacent fence gate corners (fixing the blind `?` Goblin in Bandit Camp openings).
- **Arrow Collision Physics (`projectileSim.ts`)**:
  - Arrows embed **only** in **Tree Trunks** (tight trunk-base box `rx = 0.24, ry = 0.18` at `prop.x, prop.y` — NEVER green branch canopies!) and **Palisades**.
  - Arrows **glide cleanly over Boulders/rocks and Stumps** without stopping (only ricocheting off elevated cliffs, `RuinPillar`, and stone entities like Stone Golems).
- **Manual Arrow Pickup & Ground Loot Visual Revamp (`lootManager.ts`, `worldPickups.ts`)**:
  - **Delete all `4×4` colored square pickups**: every enemy/harvest drop on the ground renders its actual crisp `32×32` outlined pixel-art item icon (`getItemHeldTexture`), scaled cleanly with drop shadow and subtle bob. Grounded loot tables ensure each species drops logical materials/items (`raw-meat`, `herb`, `arrow`, `bandage`, `cooked-meat`, `flint`, `stone`).
  - **Manual-Only Arrow Pickup**: Arrows stuck in trunks/palisades or lying on the ground render as crisp angled arrows and have **`manualPickup: true`** — they **never magnetically vacuum** into inventory. Players must approach within `2.2` tiles and manually interact (`[E]` Open / Pick up Arrow prompt on desktop, or direct tap on the arrow / `[E]` button on mobile) to collect each arrow.

---

## 4. 3-Stage Gradual Perception & Diegetic Overhead Markers

Replace binary detection with a per-entity **`suspicion` scalar (`0.0 .. 1.0`)** replicated lightly via snapshot state (`aiState`, `suspicionRatio`, `spottedPop`, `telegraphProgress`):

1. **Stage 0 — Unaware (`suspicion = 0.0`, `idle` / `patrol` / `ambush` / `feed`)**:
   - No perception indicator shown overhead.
   - Sentries follow short organic patrol waypoints or warm near campfires; beasts graze/prowl/forage naturally.
2. **Stage 1 — Suspicious / Investigating (`0.08 <= suspicion < 1.0`)**:
   - **Suspicion Gain Rate**:
     - Sight inside vision cone scales smoothly with `visibility * (1 - dist / effectiveVision) * dt` (dim twilight figure at max range fills suspicion slowly over ~`1.6s`; bright torch in front of guard at 4 tiles fills in ~`0.25s`).
     - Noise ripples (`distract`, sprinting, combat) immediately jump suspicion by `+0.45..+0.85` depending on proximity, snapping target to `investigate` toward `(noiseX, noiseY)`.
     - Discovering an allied corpse (`goblin`/`orc`/`wolf`) within `5.5` tiles jumps suspicion to `0.65` and draws the scout over to inspect the body!
   - **Overhead Visual (`aiStateIndicators.ts`)**: Outline `?` silhouette fills smoothly from bottom to top in **amber -> bright orange** matching `suspicionRatio`.
   - **Investigate Behavior**: Creature walks cautiously (`0.78×` speed) to `(lastKnownX, lastKnownY)`, pauses for `1.8s` sweeping its facing direction ±45° left and right (`lookSweep`), checks fresh `ScentTrail` breadcrumbs (`< 14s` old), and if nothing is found over `investigateDurationSec = 5.0s`, decays `suspicion` back to `0` and returns cleanly to patrol.
3. **Stage 2 — Spotted (`suspicion >= 1.0` -> `chase` / `flank` / `charge`)**:
   - Entering combat alert triggers a **`0.85s` timed `spottedPop`** (bold orange-red `!`) + species alert vocalization, then clears automatically so `!` **never sticks permanently** over chasing monsters.
   - **Camp Sentry Alert Propagation & Arrow-Hit Search**:
     - Damaging ANY creature (`spider`, `golem`, `goblin`, `bear`, `wolf`, etc.) immediately wakes it from `idle`/`ambush`/`patrol`/`sentryIdle` and sends it actively **hunting back along the incoming arrow direction** (`6–8` tiles toward the shooter), even if the archer stays hidden or outside vision range.
     - Group mates within `9` tiles seeing an ally actively fighting or spot-chasing (`chase`/`flank`/`charge`) immediately mobilize (`suspicion = 1.0`, shared target), and discovering a fresh ally corpse (`<= 6.5` tiles) jumps suspicion and triggers search/alert across campmates!
4. **Stage 3 — Attack Telegraph (`telegraphProgress > 0` or `charge`)**:
   - **Melee Windup**: Distinct pulsing crimson-gold **Windup Diamond** (`drawWindupDiamond`) synchronized with `jumpZ` height.
   - **Committed Charge (`boar` / `orc` lunge)**: Flashing dual crimson/yellow **`!!`** markers.

---

## 5. Ecological, 8-Directional & Multi-Faction AI Behaviors

### 5.1 8-Direction Movement & Combat Sprites for All Creatures
- Set `export_blend.py` default to `--dirs 8` (`south`, `se`, `side` mirrored East/West, `ne`, `north`) and re-bake all 9 enemy/wildlife sheets (`wolf`, `bear`, `spider`, `boar`, `slime`, `goblin`, `orc`, `skeleton`, `golem`) into `sprite-manifest.json` so diagonal flanking, circling, and hunting render with true 3D perspective (`entityAnimator.ts` automatic octant selection).

### 5.2 Dynamic Multi-Faction Targeting (Wildlife vs Enemies & Wildlife vs Wildlife)
- Replace player-only targeting with a unified **`CombatTarget`** registry & species faction table (`factionTargeting.ts`):
  - **Factions**: `player`, `bandit` (`goblin` + `orc`), `ruins` (`skeleton` + `golem`), `wolf`, `bear`, `boar`, `spider`, `slime`.
  - Any two non-matching factions (`a !== b`) are hostile when within perception range (`visionRange * 0.85` unprovoked, `1.4×` provoked; always honoring `!isInSanctuary`).
  - **Emergent Brawls**: Luring a Wolf pack or Grizzly Bear into a Bandit Camp sparks a genuine multi-way fight where wolves/bears attack Goblins/Orcs AND bandits strike/kill wildlife back; Bears, Boars, Wolf packs, Spiders, and Slimes skirmish naturally when crossing paths in the wild.

| Species | Pass-2 Behavioral Polish & Signature Mechanics |
| :--- | :--- |
| **Wolf (`wolf`)** | **Howl & Pack Hive-Mind**: The first wolf to spot a player pauses `0.65s` with head raised/mouth open (`howl` state), emitting an expanding silver-amber sound-ring and directional wolf howl SFX before rallying every living wolf within `18` tiles. Packmates form organic jittered flank rings (`2.0..2.8` tiles), darting in when the player's back is turned (`isBackstabAngle`) and peeling outward immediately after nipping. **Fire Wariness**: Wolves hesitate slightly outside `2.8` tiles of roaring campfires/held torches unless provoked or outnumbering `>= 3:1`. **Morale Break**: If `>= 2` packmates die and the sole survivor drops `< 25%` HP, it whimpers and retreats rapidly away (`flee`). |
| **Bear (`bear`)** | **Territorial Bluff & Scavenging**: Entering `4.2..8.5` tiles in front of an unprovoked bear triggers a `1.4s` **Territorial Bluff** (rearing scale pulse + dust stomp ring + deep warning roar SFX + distinct amber roar waves). Retreating past `6.8` tiles de-escalates cleanly back to calm patrol without aggro! If dropped `raw-meat` or a fresh non-bear corpse sits within `9` tiles, hungry bears walk up, play a `4.5s` feeding animation with chew particles, **consume** the meat/corpse, and regenerate `25%` HP while lowering baseline aggression. |
| **Boar (`boar`)** | **Committed Charge & Wall-Stun**: Locks aim direction (`0.65s` pawing windup + dust kicks + snort), then charges along a straight vector (`2.3×` speed). Hitting any `Boulder`, `OakTree`/`PineTree`, `Palisade`, or elevated cliff triggers **Wall-Impact Stun**: heavy thud + impact dust burst + micro camera shake + squeal SFX + orbiting **3 golden dizzy stars** overhead for `1.5s`, taking **`1.35×` bonus stun damage** from the player! |
| **Spider (`spider`)** | **Shadow Ambush & Horizontal Pounce**: Conceals at `0.34` alpha inside `TallGrass`/`Bush`/forest canopy or darkness; triggers subtle twin-red **eye glint** `0.3s` before leaping toward the target along an actual horizontal parabolic arc (`vx, vy, jumpVz`) covering `~3.2` tiles (`aiStateIndicators` lifts smoothly with `jumpZ`), applying a brief `1.8s` Web-Slow (`0.72×` move speed) on bite. |
| **Slime (`slime`)** | **Cohesive Swarm**: Drifts toward nearby slimes (`computeSlimeCohesion`), splits/recoils squash-and-stretch on hit, and hops cohesively rather than scattering endlessly across chunks. |
| **Goblin / Orc Sentries** | Patrol bandit camps or warm casually around campfires; coordinate Stage-2 shouts within `8` tiles; injured Goblins `< 25%` HP dash behind stronger Orc allies briefly before re-engaging; Orcs perform telegraphed wide cleaves. |
| **Skeleton / Golem Ruins** | Guardians at Ancient Ruins (`sentryIdle`): Skeletons lie dormant / rattle awake when player disturbs ruins without stealth; Golems remain immune to poison/fear and trigger telegraphed ground-slam shockwaves. |

---

## 6. UI, Audio & Multiplayer Sync Requirements

- **Protocol (`@dc2d/engine/src/net/protocol.ts`)**:
  - `WorldEntitySnapshot` carries `suspicion?: number` (`0..1`, quantized `0..20` or `0.05` steps to save bandwidth) and `stunned?: boolean` (for Boar dizzy star indicator) + `howling?: boolean` / `bluffing?: boolean`.
  - `PlayerSnapshot` carries `crouching?: boolean`, `stealthVis?: number`, `inCover?: boolean`.
  - `WorldEvent["kind"]` cleanly distinguishes `"backstab"`, `"ambushShot"`, `"pebbleLand"`, `"wolfHowl"`, `"bearBluff"`, `"boarCrash"`, and `"stealthReveal"`.
- **Audio (`packages/client/src/audio/`)**:
  - Muffled footsteps when `crouching` (`0.38×` gain).
  - Distinct pebble throw *whoosh* + surface landing clack/thump/plop.
  - High-impact *Backstab!* blade sting vs *Ambush!* bow crit chime.
  - Distinct Wolf pack howl, Bear bluff stomp roar, and Boar wall-crash thud.

---

## 7. Acceptance Criteria & Verification Tests

### Unit & Integration Tests (`@dc2d/engine` & `@dc2d/game-server`)
1. **Exposure Math**: Crouching under an Oak canopy at dusk with torch off yields `visibility <= 0.30`; lighting a torch jumps `visibility >= 0.75` even in grass cover.
2. **Gradual Suspicion State Machine**: Distant dimly-lit player builds `0 < suspicion < 1` incrementally before hitting `investigate` at `0.35` and `chase` at `1.0`, rather than frame-1 instant aggro; leaving sight decays `suspicion` back to `0`.
3. **Pebble Trajectory & Guard Pull**: Throwing a pebble (`Q` or `stone`) spawns a traveling pebble projectile blocked by elevation walls, emits noise at impact tile, and pulls nearby patrolling Goblins/Wolves to investigate that exact impact tile.
4. **Backstab & Ambush Crits**: Unaware target struck from behind triggers `2.25×` (`3.0×` dagger) + `backstab` event; crouched bow hit on unaware target triggers `1.65×` + `ambushShot`; chasing target facing player gets `1.0×`.
5. **Wolf Howl, Bear Bluff & Boar Crash**: Alerting 1 wolf plays `0.65s` howl then rallies wolves `<= 18` tiles; retreating from bluffing bear calms aggression; Boar charging into `Boulder`/`Palisade` sets `staggerTimer >= 1.4` and `stunned: true` + `boarCrash` event.

### Playtest Sign-Off Checklist (PC & Mobile)
- [ ] Hero displays genuine crouched stealth posture (no sprite vertical squashing) across all 8 directions and armor sets.
- [ ] HUD Stealth Eye + Light Gem smoothly reflects sun/shade/bush/campfire/torchlight in real time and never disappears confusingly when sneaking.
- [ ] Aimed pebbles arc cleanly onto the target spot, ripple on impact, play surface-matched sounds, and cleanly pull guards away from campfires.
- [ ] Overhead `?` smoothly fills during suspicion, `!` pops cleanly once and disappears after `0.85s`, Boar crashes show dizzy stars, Wolves howl with expanding rings, and Bears rear in bluff before calming if you back away.
