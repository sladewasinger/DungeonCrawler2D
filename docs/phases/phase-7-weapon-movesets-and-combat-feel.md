# Phase 7 — Weapon-Specific Movesets, Combat Timing & Tactile Feel

> **Status**: ✅ Complete (Pass 1 + Pass 2 landed; `Hero_Punch` combo spritesheet explicitly deferred to [Phase 12 Polish](../ROADMAP.md#phase-12--co-op-polish-adaptive-music-3d-rig-polish--qa-benchmarks))
> **Primary Touchpoints**:
> `@dc2d/content` (`src/items/catalog.ts`, `src/recipes/recipes.ts`),
> `@dc2d/engine` (`src/combat/weapons/weaponMovesets.ts`, `src/combat/combatRules.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/combatSim.ts`, `src/sim/combatActions.ts`, `src/sim/wildlife/`),
> `@dc2d/client` (`src/render/combat/weapons/`, `src/render/combat/combatVfx.ts`, `src/render/world/playerHeldLayout.ts`, `src/render/world/playerSprite.ts`, `src/audio/weapons/`)

---

## 1. Player Fantasy & Story Walkthrough

Swapping weapons in the bottom hotbar should change **every beat of combat**—how fast your hero winds up, how far your feet lunge forward, whether the hero stays committed to a blow or rolls out of danger early, how loud the air cracks on release, and how violently the camera and enemy react on contact:

- **Sword (`1 -> 2 -> 3` Agile Combo)**: Quick click triggers a crisp **Slash**, buffering a second tap chains seamlessly into a reversing **Backhand**, and a third tap drives the hero forward in a piercing **Lunge** with an elongated amber-gold streak and extra reach.
- **Axe (`chop -> cleave` Heavy Cleaver)**: Pressing Attack pulls the iron blade far back behind the shoulder during a readable windup, then chops violently across a wide `1.32 rad` arc—staggering guards cleanly and chewing through tree trunks on contact.
- **Pickaxe (`overheadSlam` Armor Breaker)**: Holding or swinging lifts the Pickaxe high overhead (`-18.7px` telegraph apex) before slamming it straight down into the earth with a dusty shock-ring, screen thump, and jagged ground-crack decal—shattering Stone Golem armor and highland ore veins alike.
- **Torch (`sweep -> flame thrust` Pyromancer Sidearm)**: Whipping a lit Torch leaves crackling amber embers and ignites Spiders, Slimes, and bandits on contact with a real **Burn** status tick.
- **Flint/Iron Dagger, Wooden/Iron Spear, and Iron Greatsword**: Real craftable/lootable weapons bringing rapid `3.0×` backstabbing daggers, long-reach spear pokes behind a raised shield, and devastating two-handed greatsword arcs.
- **Shield Block, Timed Parry & Counter-Riposte**: Raising a wooden/reinforced shield blocks strikes cleanly at stamina cost, while snapping it up inside the `0.22s` **Parry Window** blasts a golden shock-ring, rings steel on steel, locks the attacker in `1.4s` stagger, and sets up a **1.75× `RIPOSTE!`** counter-blow.
- **Held Heavy Attack**: Holding the Attack button (`>= 0.35s`) on desktop or mobile winds up a signature **Heavy Strike**—breaking shields, crushing enemy poise, and sending foes flying backward.

---

## 2. Pass-1 Audit (What Exists vs What Is Half-Baked)

| Area | What Exists in Pass 1 (`7ae80712`) | Pass-2 Gaps to Fix |
| :--- | :--- | :--- |
| **Impact Timing** | `WEAPON_MOVESETS` defines per-step durations/multipliers; `combatSim.tryMeleeSwing` emits `swing`. | **Frame-0 Instant Hit Bug**: `dispatchMeleeSector` resolves all damage & knockback on the very tick Attack is pressed—even for slow overhead Pickaxe slams (`0.40s`) and wide Axe chops (`0.38s`) where the visual swing hasn't crossed the target yet! |
| **Hero Body vs Floating Weapon** | `playerHeldLayout.ts` swaps to `rawMain` on swing while `actorGroup` shifts a couple pixels (`computeWeaponSwingLunge`). | In 3D hero sprites, the weapon detaches from the hero's idle hands and floats along `computeWeaponSwingPose` while the hero's baked 3D arms remain hanging at their sides! Needs baked/composited swing poses or shoulder/hand-anchored weapon arm follow-through + committed torso twist. |
| **Input Buffering & Cancels** | `attackQueued` clears every tick if `swingTimer > 0` (`localSwingTracker.ts` blocks local prediction during swing). | Tapping slightly early before a Sword slash finishes drops the combo input, making combos feel unresponsive on both desktop and mobile. Also cannot dodge-cancel early windup frames. |
| **Held Heavy Attacks** | Not implemented (`bow` uses hold-to-charge; melee only reads tap `attack`). | Holding left mouse or mobile `ATK` on melee weapons does nothing special. Missing heavy guard-break finishers. |
| **Torch `ignites: true`** | `WEAPON_MOVESETS.torch` declares `ignites: true` on both steps. | **Dead Flag**: Nothing in `combatSim.ts` or `combatActions.ts` reads `step.ignites`! Swinging a Torch never sets enemies on fire, deals no burn DoT, and has no flame-on-hit VFX. |
| **Stubbed Archetypes** | `WEAPON_ARCHETYPES` includes `"spear"`, `"dagger"`, `"greatsword"` with timing tables and smears. | Zero actual items in `ITEM_CATALOG`, zero sprites in `public/assets/gear/` / `heldWeapons.ts`, zero crafting recipes, zero drops—completely unreachable in gameplay! |
| **Weight, Hitstop & Shake** | `CombatVfxLayer` uses one hardcoded `MELEE_SWING_TUNING.hitstopHitSec` across all weapons. | Dagger pokes, Axe chops, and Pickaxe slams have identical freeze frames and zero micro camera shake or Pickaxe ground impact crack decals. |
| **Shield Riposte** | `applyIncomingPlayerHit` triggers `staggerTimer = PARRY_STAGGER_SEC` and `parry` event on timed block. | Attacking a parried, staggered creature grants no extra `RIPOSTE!` multiplier or feedback; blocking at zero stamina lacks guard-break stun. |

---

## 3. Authoritative 3-Phase Swing Architecture (`Windup -> Active -> Recovery`)

Replace frame-0 hit resolution in `packages/game-server/src/sim/combatSim.ts` with a real per-swing timeline driven by `WeaponStepSpec`:

### 3.1 Phase Windows (`WeaponStepSpec` additions)
Every `WeaponStepSpec` specifies normalized timeline boundaries (`0.0 .. 1.0`) over `swingDurationSec`:
- **`windupEnd` (e.g. `0.20` Dagger, `0.26` Sword, `0.36` Axe, `0.42` Pickaxe Slam, `0.44` Greatsword)**:
  - Weapon draws back / lifts overhead; player movement slows cleanly (`0.85×` light, `0.72×` medium, `0.58×` heavy).
  - Dodge-roll pressed during early windup (`swingProgress < windupEnd * 0.75`) **cleanly cancels** the swing without spending hit damage (mobility safety net!).
  - Emit `"swingWindup"` or start `swing` visual immediately so enemies/PvP foes and the player see the telegraph build.
- **`activeAt` (`windupEnd .. activeEnd`, e.g. `0.26..0.46` Sword, `0.36..0.58` Axe, `0.48..0.64` Pickaxe slam impact)**:
  - Server stores `pendingSwing` (`heldItem`, `archetype`, `stepIndex`, `heavy`, `aimX`, `aimY`, `hitTargets` Set) on `PlayerCombatState` instead of resolving `dispatchMeleeSector` on frame 0!
  - As the swing reaches `activeAt`:
    1. Emit `swingRelease` / active smear peak + lunge velocity impulse along `(aimX, aimY)`.
    2. Evaluate sector/line collision once per target inside the active window (so sweeping Axe arcs catch striding enemies mid-arc instead of missing on frame 0!).
    3. For **Pickaxe `overheadSlam`**, reaching `activeAt = 0.56` lands the head directly on `(x + aimX * range, y + aimY * range)` with a stone shock-ring + ground-crack decal + AoE chip splash (`radius = 0.65` tiles around slam point)!
- **`recovery` (`activeEnd .. 1.0`) + Input Buffer (`0.18s`)**:
  - Pressing Attack or Dodge during the final `0.18s` of a swing buffers the next input (`bufferedAction: "attack" | "dodge"`) and fires it automatically on the exact first tick the previous swing completes (`actionCooldown` ready)!
  - On client `localSwingTracker.ts`: match windup/active/recovery cadence seamlessly so visual smears, audio whoosh (`synthWeaponSfx`), and server damage popups land **on the exact same frame**!

---

## 4. Hero Body Commitment & Kinesthetics

### 4.1 Connecting 3D Hero Posture to Weapon Swings
In `playerSprite.ts` / `playerHeldLayout.ts`:
- Eliminate the disconnected "static body + orbiting flying sprite" look:
  - Bake lightweight 1–2 keyframe attack anticipation/follow-through clips OR drive dynamic directional posture + anchored shoulder/grip pivot offset:
    - Preferred full 3D approach: add a concise **3-frame `Hero_Attack` action** (`f1` shoulder-pull windup, `f2` extended horizontal/diagonal follow-through torso twist, `f3` overhead raise/slam follow-through) in `tools/sprite-studio/player_actions.py` baked cleanly into `player-rig.json` with `handSockets` (`attack` clip!), mapped directly from `motion` (`slash`/`chop`/`cleave` -> windup `f1` to follow-through `f2`; `overheadSlam` -> raised `f3` into downward punch; `lunge`/`thrust` -> crisp side-stance thrust)!!
    - Because arms & armor sleeves come directly from the 3D rig in every direction, the hero's 3D lead/weapon hand stays genuinely gripping/following every swing across armor sets with zero procedural 2D arm artifacts!

### 4.2 True 3D 8-Dir Baked Bow & Subtle Dashed Aim Line (`playerSprite.ts`, `export_player_layers.py`)
- Replace any flat rotating 2D bow sprite overlay with a true **3D Blender-baked 8-directional bow layer** (`weapon-bow.png`, `3×5` frames matching `Hero_Bow` `ready` / `half-draw` / `full-draw` across `south`, `se`, `side` mirrored E/W, `ne`, `north`) rendered with player body/arm Holdout masking so bow limbs sit naturally in front of/behind the torso and align cleanly inside the hero's lead hand across every octant with `rotation = 0`.
- Render a subtle **world-space dashed aim line** extending along `(aimX, aimY)` whenever holding the bow (soft translucent dashes brightening slightly while drawing, especially valuable for precision mobile thumb aiming and long shots).

### 4.3 Locked Enemy Attack Windup Direction (Dodgeable Telegraphs)
- Once any delayed-attack enemy (`bear`, `golem`, `orc`, `goblin`, `skeleton`, `wolf`, `spider`, `slime`) begins its attack telegraph (`telegraphTimer > 0`), its **facing direction is locked** until the attack resolves:
  - Rolling past a rearing Bear or Golem during its windup lets the player evade behind it cleanly instead of the enemy snapping 180° to hit them (`finishWindupStrike` validates frontal sector `halfArcRad = 1.05` against the locked facing vector!).
  - **Explicit Exception (`boar`)**: Wild Boars keep brief pawing pre-charge tracking during windup before locking into their straight-line high-speed charge.

### 4.4 Weight-Scaled Hitstop, Knockback & Camera Shake
Add `weightTier: "light" | "medium" | "heavy"` (or explicit `hitstopSec`, `shakePx`, `knockbackMult`) to `WeaponStepSpec` & `WorldEvent`:
- **Light (`dagger`, `torch`, `sword` steps 1–2)**: `hitstop = 28ms`, `shake = 0.6px`, crisp snappy impulse.
- **Medium (`sword` lunge, `spear`)**: `hitstop = 42ms`, `shake = 1.4px`, piercing stagger step.
- **Heavy (`axe`, `pickaxe`, `greatsword`, any Charged Heavy Strike)**: `hitstop = 62–78ms`, `shake = 2.8–4.0px` decaying exponentially over `0.16s` in `WorldScene`, plus radial dust/crack decals on `overheadSlam`.
- Ensure hitstop throttles cleanly in PvP/multiplayer visuals without locking input buffers!

---

## 5. Complete Weapon Roster, Status Effects & Charged Heavy Strikes

### 5.1 Real Items, Sprites & Recipes for All 8 Archetypes (`@dc2d/content` + `heldWeapons.ts`)
Promote `"dagger"`, `"spear"`, and `"greatsword"` from empty engine stubs into full playable weapons (plus keep existing Sword, Axe, Pickaxe, Torch, Bow):

| Weapon Item (`id`) | Archetype | Style & Signature Role | Crafting / Source |
| :--- | :--- | :--- | :--- |
| **`sword`** (Iron Sword) | `sword` | 3-hit `slash -> backhand -> lunge` finisher (`1.48×` reach-poke); balanced stamina (`12`). | Craftable / lootable / Sandbox chest |
| **`flint-dagger`** / **`dagger`** | `dagger` | Fast 3-hit `thrust -> backhand -> thrust` (`0.18s/step`), low stamina (`7`), **`3.0×` stealth backstab** multiplier, highest movement fluidity. | Craftable in hand/Workbench (`1 wood + 2 flint`) + Bandit drops + `32×32` HUD & `48 px/m` held sprite |
| **`wooden-spear`** / **`spear`** | `spear` | Long-reach narrow-arc 2-hit `thrust -> lunge` (`1.32×–1.46×` range, `0.42×` narrow cone), ideal for kiting charging boars and **Shield-Poke** spacing while blocking! | Starter slot 0 + craftable (`3 wood + 2 flint`) + dedicated `48 px/m` held spear & smear (`spear` long lance trail) |
| **`axe`** (Woodcutter Axe) | `axe` | 2-step heavy chop -> reverse cleave (`chop` -> `cleave`), wide `1.32 rad` sweep, breaks shields & staggers foes, harvests Wood (`28` power). | Craftable (`3 wood + 2 stone`) + Bandit drops |
| **`pickaxe`** (Stone Pickaxe) | `pickaxe` | `overheadSlam`: high `-18.7px` lift arcing down into a `0.65`-tile AoE stone shock-ring; deals **`1.40×` bonus armor-crush damage** to rocky/armored foes (`golem`, `skeleton`); harvests Stone & Ores. | Craftable (`2 wood + 3 stone`) |
| **`iron-greatsword`** | `greatsword` | **Two-Handed Heavy Blade** (auto-clips offhand shield cleanly like Bow; supports a weaker **2H blade block & timed parry** with `0.45` mitigation, `1.35×` stamina drain & `0.8×` parry window), sweeping `cleave -> reverse cleave` (`1.35× -> 1.65×` damage, `1.24×` reach, massive knockback & stagger). | Workbench Tier-2 craftable (Phase 8 ingots/materials) + dedicated long broadblade art |
| **`torch`** | `torch` | Fast 2-hit `slash -> flame thrust` illuminating dark spaces and **inflicting Burn**! | Craftable (`2 wood + 1 flint`) + Sandbox chest |
| **`bow`** (Hunter Bow) | `bow` | Vertical 3D-held `Hero_Bow` with slight mouse-aim tilt, 3-frame draw pose, sweet-spot arrow glint, recoverable arrows. | Craftable / Sandbox chest + arrow crafting |

### 5.4 Non-Weapon Item Use vs. Bare-Fist Punching & Polish Action Items
- **Non-Weapon Use Guard (`isMeleeItem`)**: Activating non-weapon items (`bandage`, `berry`, `cooked-meat`, `wood`, `map`, placeables, etc.) uses the item without playing a melee weapon swing or slash trail—even when a consumable cannot apply (e.g., bandage at full HP).
- **Bare-Fist Punching Indicator (`unarmed` `"punch"` motion)**: Empty-handed attacks (`heldItem === null`) cycle alternating `"punch"` combo steps (`sweepDir: 1 | -1`) with forward thrust lunges, alternating knuckle speed-lines + forward fist shockwave arcs (`drawPunchImpact`), and punch thump SFX (`synthWeaponSfx`).
- **Crisp Hi-DPI Popups & Badges**: Damage/callout popups and ground-loot count badges render at `resolution: 2` with linear texture filtering and `scale = 0.24`, with stealth callouts (`AMBUSH!`, `BACKSTAB!`) offset above damage numbers.
- **Polish Phase Action Item**: Bake dedicated `Hero_Punch` combo animations into the 3D player spritesheets (tracked in [Phase 12 Polish](../ROADMAP.md#phase-12--co-op-polish-adaptive-music-3d-rig-polish--qa-benchmarks)).

### 5.2 Torch Ignition & Burn Status (`ignites: true`)
- Wire `spec.ignites` cleanly into `combatSim.ts` / `creatureAi.ts` / `combatActions.ts`:
  - Any target struck by a step with `ignites: true` receives **`burnTimer = 3.2s`** (refreshes on hit, ticks **`4` fire damage every `0.8s`** = `16` bonus fire DoT damage, with `1.35×` vulnerability on **Spiders** and **Slimes**).
  - Water extinguishes burn immediately (`inWater` clears `burnTimer = 0` with a brief white steam puff!).
  - Render tiny rising orange flame/smoke particles on burning entities and tint flame light subtly.

### 5.3 Held Heavy / Charged Melee Attacks
- **Input Detection (PC + Mobile)**:
  - Holding Left Mouse (or holding the mobile `ATK` button for melee items >= `0.35s`) enters a short melee charge (`meleeCharge = 0..1` over `0.55s`) with a crisp glint & pulled-back stance, releasing a **Heavy Strike** on button up (or auto-launching cleanly at full hold? **Release-to-fire** above `0.25s`, while quick tap `< 0.20s` fires light combo immediately on release or minimal buffer!). Wait: to ensure **zero tap latency** on light combos, keep light attack starting immediately on `pointerdown` for quick taps? **NO—standard crisp Souls/Action pattern**:
    - Option A (Dedicated Heavy key `R` / Right-Click when no shield OR Shift+Click / Hold-Threshold): Wait—remember `Right-Click` blocks when shield is equipped! Better clean design:
      - **PC**: `Left-Click` quick tap fires instant responsive light swing (`0ms` delay!), OR hold **`Middle-Click` / `R`** / **`Shift + Left-Click`** OR hold **`Right-Click` when no shield equipped**? Even more intuitive across BOTH PC & Mobile:
      - **Tapping Left-Click / `ATK` starts a `0.10s` Windup immediately**: if the player is STILL holding the pointer past `0.24s` inside windup (for non-bow melee), the windup smoothly extends into a glowing **Heavy Charge Windup** (`0.55s` total) until release, spending `+14` extra stamina (`heavyStaminaExtra`) and dealing **`1.65×` damage, `+65%` knockback, and breaking shields cleanly**! If they simply clicked normally (`pointerup` within `< 0.22s`), the swing completes seamlessly as a crisp light attack with zero perceived lag! Wait: what about mobile thumb taps (~`80ms`)? Works identically on BOTH PC and mobile with a single intuitive Attack control!

---

## 6. Shield Block, Timed Parry, Guard Break & Riposte Payoff

- **Shield & Two-Handed Blade Blocking (`Right-Click` / Mobile `BLOCK` / `PARRY`)**:
  - Offhand shields mitigate incoming frontal damage by `blockMitigation` (`0.75` wooden shield, `0.85` upgraded) at stamina cost (`rawDmg * 0.6`).
  - **Two-Handed Blade Guard (`iron-greatsword`)**: Raises the greatsword defensively even without a shield (suppressed on `bow`), providing a weaker block (`0.45` mitigation, `1.35×` stamina drain) and a tighter timed-parry window (`0.8× PARRY_WINDOW_SEC`).
  - Blocking when stamina drops to `0` triggers **Guard Break**: knocks block off, stuns player `0.65s` with crack SFX + white shatter sparks!
  - **Spear Shield-Poke**: Pressing Attack while blocking with a `spear` allows a safe forward thrust while keeping `blockMitigation` active during windup (`+stamina cost`)!
- **Timed Parry (`blockElapsed <= PARRY_WINDOW_SEC = 0.22s`)**:
  - Nullifies `100%` HP & stamina cost, plays metallic gold *CLANG* + golden shock-ring + `PARRY!` popup + `hitstop = 75ms`, and sets **`staggerTimer = 1.45s`** + **`parried: true`** on the attacker.
- **Counter-Riposte (`RIPOSTE!`)**:
  - Any melee attack hitting an enemy whose `staggerTimer > 0 && parried` triggers **`1.75×` Riposte Critical**, plays a deep golden chord sting + `RIPOSTE!` banner popup, and clears `parried` cleanly after the strike lands.

---

## 7. Audio, VFX & Mobile/Sandbox Ergonomics

- **Audio (`packages/client/src/audio/weapons/synthWeaponSfx.ts`)**:
  - Pitch-modulated swing whoosh matching windup -> active peak timing (`activeAt`).
  - Distinct impact families on flesh vs wood vs stone/armor vs shield block vs parry ring vs burn crackle.
  - Heavy charge glint *shing* cues so the player hears the exact millisecond Heavy Charge completes.
- **VFX (`weaponSmearDraw.ts`, `combatVfx.ts`)**:
  - Smear geometry tied to `step.motion` & `archetype`: curved slash ribbons, alternating backhand S-arc, sharp elongated piercing needle for Sword Lunge / Spear / Dagger, wide thick golden-steel chop arc, overhead vertical smash arc + radiating ground-crack lines & flying pebbles on Pickaxe `overheadSlam`, ember fire ribbon on Torch.
  - Add floating damage/crit tags cleanly (`PARRY!`, `RIPOSTE!`, `GUARD BREAK!`, `BURN`, `HEAVY!`).
- **Sandbox (`/?sandbox=1`) Parity**: Ensure every weapon item (`sword`, `flint-dagger`, `wooden-spear`, `axe`, `pickaxe`, `iron-greatsword`, `torch`, `bow`) can be spawned/tested against both `spar-dummy` and `slime-dummy`/`wild` enemies directly in the sandbox chest/spawn panel.

---

## 8. Acceptance Criteria & Verification Tests

### Unit & Integration Tests (`@dc2d/engine` & `@dc2d/game-server`)
1. **Delayed Active Window**: Triggering a Pickaxe `overheadSlam` (`0.40s` duration, `activeAt ~0.50`) deals `0` damage during ticks `< activeAt`, and applies full damage + shock-ring when `swingTimer` crosses `activeAt`; dodging before `windupEnd * 0.75` cancels the swing without dealing damage.
2. **Input Buffer & Combo Chain**: Queueing `attack` during the final `0.15s` of Sword step 1 automatically transitions into Sword step 2 (`backhand`) upon completion, and again into step 3 (`lunge`), resetting cleanly if no input arrives before `comboWindowSec`.
3. **Held Heavy Strike**: Holding attack past `0.24s` transitions swing into `heavy = true`, scaling damage (`1.65×`), knockback, and breaking a blocking dummy/enemy's guard.
4. **Torch Burn & Water Extinguish**: Swinging Torch hits target with `burnTimer > 0`, ticks fire DoT cleanly over `3.2s`, deals bonus to Spider/Slime, and clears immediately on entering water (`inWater = true`).
5. **Parry -> Riposte Loop**: Timing block `<= 0.22s` before incoming strike triggers `parry` (`0` damage, `parried = true` on attacker); immediate counter-hit deals `1.75×` damage + `riposte` event.
6. **Dagger, Spear & Greatsword Items**: All 8 weapon archetypes resolve cleanly from `ITEM_CATALOG`, craft from `RECIPE_CATALOG`, enforce `maxStack: 1`, and pass `heldPlacement` pixel bounds tests.

### Playtest Sign-Off Checklist (PC & Mobile)
- [x] Every weapon (`sword`, `flint-dagger`, `wooden-spear`, `axe`, `pickaxe`, `iron-greatsword`, `torch`, `bow`, `unarmed`) feels distinct in cadence, 3-frame `Hero_Attack` pose + hand-socket alignment, weapon trail, sound, weight-scaled hitstop, and screen shake.
- [x] Attack hits land across the 3-phase `windupEnd .. activeEnd` window rather than instantaneously on button press, early windup dodge-cancels abort cleanly, and `0.18s` buffered inputs chain combos smoothly.
- [x] Held Heavy Attacks (`>= 0.24s`), Torch Burn DoT + water extinguish, Pickaxe Armor-Crush + AoE Ground Slams (`groundCrack`), Dagger `3.0x` Backstabs, Spear Shield-Pokes, Greatsword 2H Cleaves, Timed Parries (`1.45s`), and `1.75x` Ripostes all work across server combat and Sandbox.
