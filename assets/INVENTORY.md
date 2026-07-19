# Art Inventory — v2

Practical map of what's on disk in `assets/` for the rendering team. Source
pack: **0x72 DungeonTileset II v1.7** (CC0) — see `assets/LICENSES.md` for
provenance/verification. Font: **monogram.ttf** (CC0).

## How this pack is structured (read this before writing loader code)

This is **not** a uniform grid atlas like the old v1 Cainos pipeline
(`docs/TILESET.md`'s `index = row·32 + col` scheme doesn't apply here).
`0x72_DungeonTilesetII_v1.7.png` is a **512×512 px packed sprite sheet**;
every sprite occupies an irregular `(x, y, w, h)` rect recorded by name in
`assets/dungeon/tile_list_v1.7.txt` (370 lines, format
`frame_name  x  y  w  h`, pixel units, origin top-left). Frame widths/heights
vary by content: **16×16** for most tiles/small monsters, **16×23** for
medium monsters, **16×28** for the 4-tall hero sprites (extra height is a
raised head/hood — feet still sit on a 16×16 footprint), **16×36** for big
monsters, **6×7** for the coin, **13×12** for UI hearts, and assorted small
rects for weapon icons. Load it as a Phaser texture atlas: convert
`tile_list_v1.7.txt` into a Phaser `atlas` JSON (or a `Map<name, Rect>` and
`texture.add()` per frame) — do not slice by fixed grid math.

Rough visual regions on the sheet (for orientation, not for math):
- **x 0–111** — floor tiles, basic/edge/outer wall pieces, fountains, goo, banners, doors, buttons/levers, spikes, ladder, stairs, hole
- **x 128–271** — the 10 hero classes, stacked in rows (idle/run/hit)
- **x 288–351** — potion flasks, chest animations, coin, crate, skull, UI hearts, weapon icons
- **x 288–352 (lower)** — shelf/crate cluster (decorative row near y 400–450)
- **x 368–511** — small/medium monster roster (idle/run rows, one monster type per row)
- **x 16–112, y 320–465** — the 3 big monsters (demon, zombie, ogre) and their attendant mid-size monsters (wogol, orc_shaman, etc. overlap this band)

Supplementary files (pre-composed, same source pixels, useful as autotile
masking reference — not required to use):
- `assets/dungeon/atlas_floor-16x16.png` (112×112) — floor autotile blob set
- `assets/dungeon/atlas_walls_low-16x16.png` (192×64) — low-wall 3×3-minimal autotile set
- `assets/dungeon/atlas_walls_high-16x32.png` (384×128) — high-wall 3×3-minimal autotile set (banners/fountains included as accessories)
- `assets/dungeon/README_0x72.txt` — the pack author's own notes on how the autotile sets are meant to be sliced (3×3 minimal per godot-docs#3316; 16×32 tiles render with a −8px (or −2px) Y offset so their base lines up with the 16×16 footprint grid)

## Terrain — floors (static, 16×16)

`floor_1` … `floor_8` — 8 stone-floor variants for randomized tiling. Plus
`floor_ladder`, `floor_stairs` (single static tread), `hole` (pit/chasm),
`edge_down` (a lip/shadow tile for a floor-to-pit transition).

**Animated:** `floor_spikes_anim_f0..f3` — 4 frames, retract→extend cycle.

## Terrain — walls (static unless noted, 16×16 base / 16×32 "high" set)

Basic wall faces: `wall_left`, `wall_mid`, `wall_right`, `wall_top_left`,
`wall_top_mid`, `wall_top_right` (6 pieces — a minimal wall-cap kit, thinner
than v1's 16-mask brick grammar).

Elevation/edge kit (**this is the pack's closest thing to cliff-face art** —
see GAPS): `wall_edge_bottom_left`, `wall_edge_bottom_right`,
`wall_edge_mid_left`, `wall_edge_mid_right`, `wall_edge_top_left`,
`wall_edge_top_right`, `wall_edge_left`, `wall_edge_right`,
`wall_edge_tshape_bottom_left`, `wall_edge_tshape_bottom_right`,
`wall_edge_tshape_left`, `wall_edge_tshape_right`, `wall_outer_front_left`,
`wall_outer_front_right`, `wall_outer_mid_left`, `wall_outer_mid_right`,
`wall_outer_top_left`, `wall_outer_top_right` — 18 pieces total, dungeon
masonry palette (browns/greys), designed for wall-top/rim reads consistent
with the "wall = raised terrain, top is walkable" model in
`docs/ARCHITECTURE.md`. Runtime brick faces are vertical facade art projected one
cell south of their owning raised tile; they are not a second raised wall surface.

Decoration built into walls: `wall_hole_1`, `wall_hole_2` (broken-wall
holes), `wall_banner_blue/red/green/yellow` (4 banners), `wall_goo_base`,
`wall_goo` (static ooze drip), `column`, `column_wall` (16×48 pillars).

**Animated fountains** (multi-piece assemblies — `wall_fountain_top_*` static
cap + animated mid + animated basin, mix blue/red variants):
- `wall_fountain_mid_blue_anim_f0..f2` / `wall_fountain_mid_red_anim_f0..f2` — 3 frames each (water gurgle)
- `wall_fountain_basin_blue_anim_f0..f2` / `wall_fountain_basin_red_anim_f0..f2` — 3 frames each
- `wall_fountain_top_1/2/3` — static cap variants

## Doors, mechanisms

`doors_frame_left` (16×32), `doors_frame_right` (16×32), `doors_frame_top`
(32×16), `doors_leaf_closed` (32×32), `doors_leaf_open` (32×32) — full door
assembly, static open/closed (no in-between swing frames).
`button_red_up/down`, `button_blue_up/down` (4, pressed/unpressed pairs),
`lever_left/right` (2, thrown states) — usable for the game's zone
kiosks/mechanisms even though not in the current design docs.

## Heroes — 10 playable classes (16×28)

Each class ships **idle (4 frames) + run (4 frames) + hit (1 frame) = 9
frames**, so all animate per the "no static entities" rule out of the box:

| class | frames |
|---|---|
| `wizzard_f`, `wizzard_m` | idle×4, run×4, hit×1 |
| `knight_f`, `knight_m` | idle×4, run×4, hit×1 |
| `dwarf_f`, `dwarf_m` | idle×4, run×4, hit×1 |
| `lizard_f`, `lizard_m` | idle×4, run×4, hit×1 |
| `elf_f`, `elf_m` | idle×4, run×4, hit×1 |

No dedicated death/cast/throw animations — only idle/run/hit. Each class has
a fixed base palette (no built-in recolors); multi-player disambiguation
needs a procedural palette-swap pass (per `docs/ARCHITECTURE.md`'s note that
"player characters get palette-swap variants").

## Monsters — big (32×36, idle + run, no hit frame)

`big_demon`, `big_zombie`, `ogre` — 8 frames each (idle×4, run×4).

## Monsters — small/medium (16×16 or 16×23)

**Idle + run (8 frames each):** `imp`, `tiny_zombie`, `goblin`, `skelet`,
`angel` (all 16×16); `wogol`, `orc_shaman`, `masked_orc`, `orc_warrior`,
`doc`, `pumpkin_dude` (halloween bonus char), `chort` (all 16×23).

**Single walk-cycle only, no idle/run split (4 frames each):** `zombie`
(16×16 — note the pack's own naming quirk: first frame is literally named
`zombie_anim_f10` not `f0`, then `f1/f2/f3` — grep for `zombie_anim_f` to get
all 4, don't assume a clean `f0..f3` string pattern), `ice_zombie` (16×16),
`swampy` (16×16), `muddy` (16×16), `necromancer` (16×23), `slug` (16×23),
`tiny_slug` (16×16).

`skelet_idle_anim_f0..f3` / `skelet_run_anim_f0..f3` is a **direct, exact
match** for the game's `skeleton` enemy (`reference/content/enemies.json`) —
use as-is, no recolor needed.

## Items / props

**Potions (static, 16×16):** `flask_big_blue/red/green/yellow` (large),
`flask_blue/red/green/yellow` (small) — 8 total, one clean glass-bottle
silhouette per size, palette-varied.

**Chests (16×16, 3-frame open animation each):**
`chest_empty_open_anim_f0..f2`, `chest_full_open_anim_f0..f2`,
`chest_mimic_open_anim_f0..f2` — the mimic variant is a bonus (a chest that's
actually a monster) with no design-doc hook yet but free to use later.

**Other:** `bomb_f0..f2` (3-frame fuse burn, 16×16), `coin_anim_f0..f3`
(4-frame spin/glint, 6×7 — matches "items on the ground bob and glint"),
`crate` (static, 16×24), `skull` (static, 16×16), `ui_heart_full/half/empty`
(static, 13×12, ready-made HUD health pips).

**Weapon icons (27, static, small irregular rects ~6–16px):**
`weapon_regular_sword`, `weapon_rusty_sword`, `weapon_golden_sword`,
`weapon_knight_sword`, `weapon_lavish_sword`, `weapon_duel_sword`,
`weapon_red_gem_sword`, `weapon_anime_sword`, `weapon_katana`,
`weapon_saw_sword`, `weapon_machete`, `weapon_cleaver`, `weapon_knife`,
`weapon_axe`, `weapon_double_axe`, `weapon_throwing_axe`, `weapon_waraxe`,
`weapon_mace`, `weapon_hammer`, `weapon_big_hammer`,
`weapon_baton_with_spikes`, `weapon_spear`, `weapon_bow`, `weapon_bow_2`,
`weapon_arrow`, `weapon_red_magic_staff`, `weapon_green_magic_staff`. These
are equip/hand-overlay icons (meant to attach to a hero's hand slot), not
ground-item icons, but double as inventory-slot art directly.

`weapon_rusty_sword` is a **direct match** for the game's `sword` item
("Rusty Sword" — `reference/content/items.json`). `weapon_knife` matches
`knife`. `weapon_hammer`/`weapon_big_hammer` match `hammer`.

---

## GAPS — what the game needs that this pack does not provide

The renderer team should fill these procedurally (palette-shifted recolors /
composites of pack tiles, or small runtime-generated primitives) rather than
by sourcing a second art pack — mixing packs violates
`docs/VISUAL_DIRECTION.md`'s single-resolution/single-palette rule.

1. **Torches / fire light sources — total gap.** Grepped the full 370-entry
   frame list for `torch|fire|flame` — zero hits. This pack has **no torch
   sprite, no wall-mounted torch, no flame animation at all**, despite
   `docs/VISUAL_DIRECTION.md` making torchlight the centerpiece of the whole
   look ("Every torch, fire area... is a light source with subtle flicker").
   Nearest raw material to recolor/build from: the fountain assembly pieces
   (`wall_fountain_top_*` cap + a 3-frame animated "basin" swapped to
   orange/ember palette) could be kitbashed into a wall-mounted brazier, or a
   torch can be hand-built from `weapon_knife`-style silhouette + procedural
   flame particles. This is the single biggest gap against the visual spec.

2. **Particle/VFX sprites — total gap.** No embers, smoke, sparks, bubbles,
   or steam frames anywhere in the pack (same grep, zero hits for
   `smoke|spark|particle`). Needed for: `area-fire`, `area-smoke`,
   `area-steam`, `area-poison`, `area-oil`, `area-wet` (all in
   `reference/content/areas.json`) and for hit-flash/knockback/dust-puff
   juice in `docs/VISUAL_DIRECTION.md`. Recommend **not** sourcing a second
   pack for this (evaluated Kenney's CC0 Particle Pack — rejected, it's
   soft/vector-style at a different effective resolution, exactly the
   asset-soup mismatch the direction doc warns against). These read better
   as runtime-generated small colored primitives (tinted squares/circles)
   driven by the light layer than as sprite-sheet art anyway — a code task,
   not an asset-acquisition one.

3. **Cliff faces for heightmapped *outdoor* terrain — partial gap.** The
   pack's `wall_edge_*`/`wall_outer_*` kit (18 pieces, listed above) gives
   elevation-readable rims for **dungeon masonry** walls, which covers the
   "wall top is walkable, cliff face is shadowed" model for interior rooms.
   But the pack is 100% dungeon-interior themed — no grass, dirt, or natural
   rock texture exists anywhere in it. Outdoor/terrace cliff faces
   (`docs/ARCHITECTURE.md` mentions terraces/plateaus/chasms) will need a
   palette-shifted recolor of the existing masonry edge kit (desaturate
   toward the stone-grey `#2e2e3a`–`#494956` range already in the palette
   spec) rather than a genuinely different rock texture — flag to design
   whether a masonry-look "cliff" reads acceptably or whether a bespoke
   natural-rock edge set is worth commissioning later.

4. **Stair treads — thin.** Only one static tile, `floor_stairs` — no
   multi-step tread set for continuous, fine-grained height transitions (the
   engine's height model is continuous per `docs/ARCHITECTURE.md`, not
   discrete floor levels). Procedural: generate a handful of half-height
   "tread" rects by cropping/offsetting the existing wall-cap pieces, or
   commission 3–4 stair-tread variants at matching pixel density.

5. **Sanctuary floor variant — gap, but exactly the kind this pipeline
   expects to solve procedurally.** No teal/blessed floor tile exists; v1's
   pipeline (`docs/TILESET.md`) already did this as a runtime teal recolor
   of a base floor tile, so replicate that against `floor_1..floor_8` here.
   Straightforward, no new source art needed.

6. **Specific item icons — total gap for 4 of 10 current items.**
   Cross-checked every item in `reference/content/items.json` against the
   370-frame manifest:
   - Matched directly or near-directly: `knife`→`weapon_knife`,
     `sword`("Rusty Sword")→`weapon_rusty_sword`,
     `hammer`→`weapon_hammer`/`weapon_big_hammer`,
     `water-flask`→`flask_blue` (or any `flask_*`),
     `vodka-bottle`→closest is a `flask_*` shape (rounded potion bottle, not
     a liquor-bottle silhouette — usable as a stand-in, not a true match).
   - **No equivalent at all:** `rag` (cloth scrap), `stick` (plain twig),
     `bandage` (wound wrap), `raw-meat` (food chunk), and **`torch` as a
     carryable/throwable item** (see gap #1 — the game also throws torches
     as a weapon per `items.json`, not just uses them as light fixtures).
     These 5 need hand-authored 16×16 icons matching the pack's shading
     style (2–3 tone, hard pixel edges, ~4px light source top-left) — small
     enough to be one focused art pass, not proceduralizable from existing
     tiles.

7. **Enemy roster — 2 of 4 current enemies unmatched.**
   Cross-checked `reference/content/enemies.json`:
   - `skeleton` → **exact match**, `skelet_idle/run` (see above).
   - `slime` → no true slime creature in the pack. `wall_goo`/`wall_goo_base`
     are static wall-ooze decals, not a creature. Closest animate-able
     substitute: recolor `swampy` or `muddy` (4-frame blobby ground
     creatures, 16×16) toward a translucent green/clear palette — usable
     stand-in via procedural recolor, not a perfect silhouette match (both
     read as "muck monster," not "gelatinous cube/slime").
   - `plant-creeper` → no plant/vine/creeper monster anywhere in the pack.
     No good substitute silhouette exists (everything else is
     humanoid/undead/beast). Flag as a real content gap — either accept a
     reskinned `swampy`/`muddy` as a placeholder or commission new art.
   - `spitter` → no ranged/spitting creature silhouette. `orc_shaman` (has a
     staff, medium 16×23, could sell "ranged caster") is the closest
     available base to recolor/reskin as a placeholder.

8. **Crafting table, stash furniture, safe-room portal — no dedicated
   sprites.** `docs/GAME_DESIGN.md` requires a stash + crafting table in
   every safe room and personal room, and a portal-door safe-room entrance.
   The pack's `chest_full_open` frames can stand in for a stash, and the
   `doors_leaf_open`/`doors_frame_*` kit can stand in for a portal doorway
   (recolor door trim toward the sanctuary teal `#3dd6c3` accent), but there
   is no purpose-built "crafting table" prop in the pack at all — nearest
   raw material is the `crate` tile as a base to build a table composite
   from, or a new small prop.

9. **Shadow blobs** — trivial, not really a gap: `docs/VISUAL_DIRECTION.md`'s
   ground-shadow-per-entity requirement is a simple procedural soft dark
   ellipse under each entity, not sourced art. No action needed here.
