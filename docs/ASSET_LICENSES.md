# Asset Licenses — the 7 explicit-heights-reskin tile packs

Companion to [`assets/LICENSES.md`](../assets/LICENSES.md) (which covers the 0x72
character/enemy set and the pixel font — both still in active use per Austin's decree
to keep 0x72 creatures for now). This file covers only the 7 new RPG-Maker-MV-format
dungeon tile packs added under `assets/packs/` for the "explicit heights reskin" pivot
and copied into `packages/client/public/assets/packs/` by the asset-foundry lane.

## The honest note

**None of the 7 pack folders contain a license file, readme, or any accompanying text
of any kind** — each folder is exactly N flat PNG sheets (`tile-B-01.png` … and, for two
packs, an `Auto-tile-A4-*.png` wall-autotile sheet), nothing else. Cross-checked against
the original download in the user's own `Downloads/medieval sewer/` folder (an
additional working directory available this session): byte-for-byte the same 7 files,
same absence of any license text.

Given the itch.io "tile-B-NN.png" naming convention, the RPG Maker MV 48px grid, and
the recurring author-style across packs (COC / Dwarf Volcano / Goblin Mechanical
Workshop / Haunted Amusement Park / dragon cave / goblin cave / medieval sewer all
follow the identical sheet-numbering and grid convention), these read as a themed
product line from a single itch.io asset creator, most likely purchased rather than
downloaded free — consistent with Austin's own framing of "new packs live in
assets/packs/" as material he already has, not something this task needed to source.
**No verifiable license text ships with these files.** Treat them as user-purchased,
commercial-use assets whose exact terms live wherever Austin bought them (itch.io order
history / product page), not in this repo. This doc does not claim CC0 or any specific
license for them — unlike the 0x72 pack and monogram font, which are independently
verified CC0 in `assets/LICENSES.md`.

## Per-pack file inventory

| Pack (kebab-case dir under `packages/client/public/assets/packs/`) | Source dir under `assets/packs/` | Sheets |
|---|---|---|
| `medieval-sewer` | `medieval sewer` | `tile-B-01.png` … `tile-B-06.png`, `Sews_MV_A4.png` (wall autotile) |
| `dragon-cave` | `dragon cave` | `tile-B-01.png` … `tile-B-09.png` |
| `coc` | `COC` | `tile-B-01.png` … `tile-B-09.png` |
| `goblin-cave` | `goblin cave` | `tile-B-01.png` … `tile-B-05.png` |
| `goblin-mechanical-workshop` | `Goblin Mechanical Workshop` | `tile-B-01.png` … `tile-B-05.png` |
| `haunted-amusement-park` | `Haunted Amusement Park` | `tile-B-01.png` … `tile-B-05.png` |
| `dwarf-volcano-underground-fortress` | `Dwarf Volcano Underground Fortress` | `tile-B-01.png` … `tile-B-05.png`, `Auto-tile-A4-Walls-1.png`, `Auto-tile-A4-walls-2.png`, `Auto-tile-A4-walls-3.png` |

All sheets are 48px-per-tile RPG Maker MV format: the `tile-B-NN.png` sheets are 16
cols × 16 rows (768×768px); the `_A4` wall-autotile sheets are 16 cols × 15 rows
(768×720px). Full per-pack breakdown (floor/wall/stair/door/torch/prop/hazard/water
piece coordinates) is in `packages/content/src/data/tileCatalog.json`, validated by
`tileCatalog.schema.ts`.

## Note on prompt-injection screening

No text of any kind (let alone automation-directed text) was found in any of the 7
pack folders — they contain only PNG image data, no readme/license/metadata files to
screen in the first place.
