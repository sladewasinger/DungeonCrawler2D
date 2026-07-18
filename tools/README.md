# tools/bake-atlas

Builds the game's sprite atlas from the 0x72 DungeonTileset II pack plus the procedural
gap-fill sprites listed in `assets/INVENTORY.md`'s GAPS section (items, sanctuary floor,
crafting table, plant-creeper/slime recolors, and the two light/VFX textures).

Self-contained: this folder has its own `package.json`/`package-lock.json`/`node_modules`
(just `pngjs`, pure JS, no native build). It never touches the repo root's `package.json` or
`package-lock.json`, and only ever writes under `packages/client/public/assets/`.

## Run it

```
cd tools
npm install   # first time only
node bake-atlas.mjs
```

(Also runnable as `npm run bake-atlas` from inside `tools/`.) Paths are resolved relative to
the script file, so it also works as `node tools/bake-atlas.mjs` from the repo root.

## What it writes

All under `packages/client/public/assets/`:

- `atlas.png` — the original 512x512 sheet copied verbatim at `(0,0)` (so every original
  frame's `x/y/w/h` from `tile_list_v1.7.txt` stays valid unchanged) plus the generated
  sprites shelf-packed into the extended region below.
- `atlas.json` — Phaser 3 texture-atlas JSON, hash format, one entry per original **and**
  generated frame, keyed by frame name.
- `animations.json` — `{ animKey: { frames, frameRate, repeat } }` for every multi-frame
  group (heroes idle/run, monsters, chests, fountains, spikes, coin, plus the generated
  plant_creeper/slime series). Single-frame groups (e.g. each hero's `*_hit`) are correctly
  excluded — the source pack only ships one hit frame per class.
- `fonts/monogram.ttf` — copied from `assets/fonts/monogram.ttf`.
- `contact-sheet.png` — every generated sprite at 4x, labeled, plus a handful of original
  pack frames alongside for a quick palette/style comparison. Open this first after any
  change to the generators.

## How parsing/grouping works (`lib/parse-frames.mjs`)

`tile_list_v1.7.txt` lines are `name x y w h`. A frame belongs to an animation group if its
name ends in `_f<digits>` or `_anim_f<digits>` (covers both the pack's usual
`name_anim_f0` convention and the plain `bomb_f0` one); the rest of the name is the group
key. Frames are then sorted by their numeric suffix — except the documented
`zombie_anim_f10` quirk (INVENTORY.md): when frame `0` is missing but a `>=10`-numbered
frame sits alongside a low run (`1,2,3`), that high-numbered frame is treated as the real
frame 0, since it's the pack's own typo, not a 10th frame.

## What's generated, and why it looks in-pack

Every color used below is sampled at runtime from a real region of the source sheet
(`lib/palette.mjs`) — nothing is invented except the two accents `docs/VISUAL_DIRECTION.md`
explicitly reserves for glows (fire/torch `#ff9e3d`, sanctuary/portal teal `#3dd6c3`).

- **Items** (`lib/sprites/items.mjs`): `item_rag`, `item_stick`, `item_bandage`,
  `item_raw_meat`, `item_torch` — hand-drawn 16x16 via polygon/line primitives
  (`lib/sprites/shapes.mjs`), then auto-outlined (any transparent pixel touching an opaque
  one gets painted the pack's shared `#222222` outline ink) so edges are always a crisp,
  non-anti-aliased 1px line like the rest of the pack.
- **`floor_sanctuary`**: `floor_1` cropped from the sheet, then its two fill colors are
  remapped to the sanctuary teal accent scaled down (0.35x / 0.55x) toward dark/desaturated;
  the mortar-crack outline color is left untouched.
- **`crafting_table`**: fresh 16x16 composite — crate/door wood tones for the tabletop and
  legs, a small hammer silhouette on top.
- **`plant_creeper_idle/run_f0..3`**: `goblin_idle/run` frames with a 2-color remap (base
  skin green -> a more saturated leafy green sampled from `wall_goo`; dark clothing slate ->
  a berry red sampled from the red banner).
- **`slime_idle/run_f0..3`**: `swampy`/`muddy` frames remapped from their native
  teal-mid/brown tones toward the same poison-green family (swampy's own lime highlight is
  already close to poison-green and is left as-is).
- **`light_soft` (64x64) / `particle_soft` (8x8)** (`lib/sprites/vfx.mjs`): the two declared
  non-pixel-art exceptions — smooth white-to-transparent radial falloffs for the lighting
  layer, not outlined or palette-quantized.

## Determinism

No `Math.random`, no `Date.now`, no filesystem read of prior output. Every value traces back
to the frozen input files, so re-running produces byte-identical results.

## Self-assessment

Reviewed via `contact-sheet.png` at 4x and, for the weaker cases, at 20x crops. `item_torch`,
`item_raw_meat`, `crafting_table`, `floor_sanctuary`, `light_soft`, and `particle_soft` read
clearly and sit comfortably next to the original frames on the comparison row. `item_rag` and
`item_bandage` are the softest of the set — recognizable but a notch more "clean pixel-art
icon" than the pack's own slightly scruffier hand-drawn items; acceptable as gap-fill, not
best-in-class. `plant_creeper` is an honest goblin recolor (green skin restyled, red
belt/accent added) rather than a genuinely plant-shaped silhouette — INVENTORY.md itself
flags this as "no good substitute silhouette exists" and expects a reskin, so this is
in line with the brief, not a discovered shortcut. `slime` reads well as a poison-green
muck creature. Every generated sprite's outline is a solid 1px `#222222` line with flat,
non-anti-aliased fills, matching the pack's own rendering discipline.
