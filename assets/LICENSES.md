# Asset Licenses

All art acquired for v2 is CC0-1.0 (public domain dedication) or an
equivalently permissive license. Anything that doesn't clear this bar does
not belong in this folder — delete rather than ship.

Per `docs/VISUAL_DIRECTION.md`, the 0x72 DungeonTileset II is the primary
(only) world-art pack for v1.0: one resolution, one palette family. Nothing
else was added — see the GAPS section of `assets/INVENTORY.md` for what's
still missing and why it isn't being patched with a second art pack.

---

## 0x72 DungeonTileset II (v1.7)

| | |
|---|---|
| Author | Robert, itch.io handle **0x72** |
| Official source | <https://0x72.itch.io/dungeontileset-ii> |
| License | **CC0 1.0 Universal** ("You can use this tileset for whatever you like (CC-0)") — also dual-licensed MIT for any accompanying code (crop scripts etc.), which we didn't take |
| Version acquired | v1.7 (current version on the itch.io page as of 2026-07-18; itch.io free "name your own price" download, latest available exceeds the v1.4 floor this task set) |
| Files | `assets/dungeon/0x72_DungeonTilesetII_v1.7.png` (main 512×512 spritesheet), `assets/dungeon/tile_list_v1.7.txt` (frame name/x/y/w/h manifest, 370 entries), `assets/dungeon/atlas_floor-16x16.png`, `assets/dungeon/atlas_walls_low-16x16.png`, `assets/dungeon/atlas_walls_high-16x32.png` (pre-composed 3×3-minimal autotile reference sheets, same source pixels), `assets/dungeon/README_0x72.txt` (pack's own autotile usage notes) |
| Download route | itch.io's own download flow isn't scriptable headlessly without a browser session/CSRF token (name-your-own-price gate). Per the task's fallback instruction, fetched from a GitHub mirror instead: **`DmIvakov/DungeonRPG`** (`assets/tileset/0x72_DungeonTilesetII_v1.7/`), raw file `https://raw.githubusercontent.com/DmIvakov/DungeonRPG/main/assets/tileset/0x72_DungeonTilesetII_v1.7/0x72_DungeonTilesetII_v1.7.png` |
| Verification | (1) Every downloaded byte size matches the GitHub Contents API's reported size exactly (no truncation/corruption). (2) All 4 PNGs open with a valid `\x89PNG\r\n\x1a\n` signature and `file` reports sane `PNG image data` with sensible pixel dimensions (512×512, 112×112, 384×128, 192×64) — not an executable or archive. The two text files (`tile_list_v1.7.txt`, `README_0x72.txt`) are plain ASCII. (3) Cross-checked: the main spritesheet's git blob SHA (`54201200af9d1ce3be3208e2a9aeadc908cc7594`) is byte-identical to the same file committed independently in a second, unrelated repo (`ossi1801/wizard_game_gd`), which is strong evidence it's an unmodified copy of the original itch.io download rather than a tampered fork. (4) File manifest (main png + `atlas_floor-16x16.png`/`atlas_walls_*` + `README` + `tile_list_v1.X` + optional `doc.png`/`pumpkin_dude.png`) matches the file list itch.io itself shows for the pack. |
| Download date | 2026-07-18 |
| Content | 16×16 (and 16×28/16×36/16×23 for taller creatures) floor/wall/prop tiles, 10 playable hero classes (idle/run/hit), ~20 monster types (idle/run), chests, doors, levers/buttons, potions, weapons icons, coins, UI hearts. Full breakdown in `assets/INVENTORY.md`. |
| Automation-directed text found? | None. The itch.io page includes a routine "No generative AI was used" disclosure in its own metadata (a statement about the asset's creation, not an instruction to any agent) — noted here for completeness, not acted on as an instruction. |

## monogram (bitmap/TTF pixel font)

| | |
|---|---|
| Author | Vinícius Menézio, itch.io handle **datagoblin** |
| Official source | <https://datagoblin.itch.io/monogram> |
| License | **CC0 1.0 Universal** ("free and CC0") |
| File | `assets/fonts/monogram.ttf` (TrueType, usable directly as a CSS/Phaser web font at any pixel size — designed as a 5×7-in-9px monospace grid, so it stays crisp at small integer sizes without needing the separate bitmap/JSON variant) |
| Download route | Same itch.io scriptability problem as above. Fetched from GitHub mirror **`tony9321/2D-portfolio`** (`public/monogram.ttf`), raw file `https://raw.githubusercontent.com/tony9321/2D-portfolio/master/public/monogram.ttf` |
| Verification | (1) Downloaded size (10,468 bytes) matches the GitHub API's reported size and matches the "10 kB" size itch.io itself lists for `monogram.ttf`. (2) File opens with a valid TrueType `sfnt` header (`00 01 00 00`) and `file` identifies it as `TrueType Font data, 14 tables` — not disguised as anything else. (3) Cross-checked: git blob SHA `aceaebab76d4ccb69d59241d154216f6f53d7e8d` is byte-identical to the same file in a second, unrelated repo (`IronGremlin/moar_ants`), whose own `assets/licenses_and_attributions.txt` independently credits: `"monogram" data goblin (datagoblin.itch.io) — Marked with CC0 1.0 Universal`. |
| Download date | 2026-07-18 |
| Automation-directed text found? | None. Same routine "No generative AI was used" disclosure as above; not an instruction. |

## Particle / VFX sprites (torch flicker, embers, poison bubbles, smoke, sparks)

**Not sourced.** The 0x72 pack ships zero fire/smoke/spark/particle frames (confirmed by grepping the full 370-entry frame manifest for `torch|fire|flame|smoke|spark|particle` — no hits). Kenney.nl's CC0 "Particle Pack" / "Smoke Particles" were evaluated as the optional extra the brief allows, but rejected: they're soft-edged, non-pixel-art textures at a different visual resolution than the 16 px source art, which would violate `docs/VISUAL_DIRECTION.md`'s explicit "one resolution... mixed source resolutions are forbidden" rule — the exact asset-soup failure mode v2 is trying to avoid. `docs/VISUAL_DIRECTION.md` itself frames effects as "particles + light, not recolored rectangles," i.e. runtime-generated small primitives (dots, circles) tinted with the accent palette and driven by the light layer, not sprite-sheet art — so this is a code/design task for the renderer team, not an asset-acquisition gap. See GAPS in `assets/INVENTORY.md`.

## Note on prompt-injection screening

All fetched page text (itch.io pages, GitHub file contents) was treated as
data. No instructions directed at an automated agent were found in any
source consulted for this task, beyond the routine "No generative AI was
used" creation-process disclosures noted above (which are not directives
and were not acted on as such).
