# TILESET.md — the map-authoring tilesheet

*Added 2026-07-07 with the switch to the Cainos pack; keep this in sync
with `TD_LAYOUT` in [tools/generate-art.mjs](../tools/generate-art.mjs).*

The Tile Studio pipeline (hand-authored map stamps) draws from a single
**combined tilesheet** composed out of the Cainos **"Pixel Art Top Down —
Basic" v1.2.3** pack (32×32 tiles, docs: <https://docs.cainos.net/pixel-art-top-down-basic>).
Yes, it's an outdoor set — it reads fine in the dungeon, and it's the
first candidate; swapping again means redoing only this file's layout.

Sources live in [assets/topdown/](../assets/topdown/) (copied from the
pack's `Texture/` folder; `Extra/` holds the with-shadow prop variants,
currently unused).

## The two baked outputs (never edit by hand — `npm run art`)

| file | tile px | consumer |
|---|---|---|
| `assets/topdown/tilesheet.png` (1024×1280) | 32 | Tile Studio palette |
| `packages/client/public/assets/pack-sheet.png` (2048×2560) | 64 | in-game `custom` tilemap layer |

Both are written from the same in-memory compose (pack-sheet is a plain
2× nearest-neighbor upscale), so a tile index means the same cell in
the editor and in the game *by construction*. Grid metadata is
published in `atlas.json → packSheet` (32 cols × 40 rows).

## Cell layout (32 cols × 40 rows, index = row·32 + col)

| combined cells (col,row) | source |
|---|---|
| (0–7, 0–7) | TX Tileset Grass |
| (8–15, 0–7) | TX Tileset Stone Ground |
| (16–31, 0–7) | *(empty)* |
| (0–15, 8–23) | TX Tileset Wall |
| (16–31, 8–23) | TX Props |
| (0–15, 24–39) | TX Plant |
| (16–31, 24–39) | TX Struct |

Handy cells (used by `tools/tile-studio/example-map.json`):

- **Stone floor 2×2 block**: cols 9–10, rows 1–2 → indices 41, 42, 73, 74.
- **Wall "room" structure** (wall-sheet cells (1..3, 1..4)):
  - top outline: 289, 290, 291 (row 9, cols 1–3)
  - side rims: 321 / 323 (row 10)
  - front-wall cap: 353, 354, 355 (row 11)
  - front-wall brick face: 385, 386, 387 (row 12)

## Terrain autotiles (re-sourced 2026-07-08)

The generated dungeon's terrain autotiles (`tiles.png` — floors, wall
grammar, sanctuary, cliff faces) now bake from the **same Cainos pack**
via measured pixel rects in `generate-art.mjs`: rough stone ground for
floors, the smooth slab (teal-shifted) for sanctuary, and the wall
sheet's caps/side-strips/brick-faces for the 16-mask wall grammar and
cliff faces. Generated terrain and hand-authored stamps share one look.

The Craftpix pack in `assets/pack/` now supplies only the stash-chest
sprite (`Objects.png`); retire it fully when the chest gets real art.

## Compatibility notes

- Maps exported against the old sheet (`walls_floor.png`, 13 cols)
  scramble on the new one. The client warns in the console when
  `custom-map.json`'s `sheetCols` disagrees with `atlas.packSheet.cols`;
  the studio warns on JSON import when the sheet name differs.
- Tile Studio's localStorage autosave is versioned (`v: 2`); autosaves
  from the old sheet are discarded on load rather than restored wrong.
