# Tile Studio

A small in-browser map editor for the game's combined tilesheet (or any
tile sheet), in the spirit of Godot's TileMap editor: pick tiles from an
auto-split palette, paint an example, let the studio learn which tiles
may touch, then paint with auto-completing borders — and export a map
the game can stamp straight over dungeon generation.

The default sheet is the Cainos top-down pack composed into
`assets/topdown/tilesheet.png` (32×32 tiles, 32×40 grid) — see
[docs/TILESET.md](../../docs/TILESET.md) for the cell layout and how to
rebuild it (`npm run art`).

## Run it

```
npm run studio
```

(vite serves the repo statically and opens `tools/tile-studio/`; the
combined sheet loads from `assets/topdown/tilesheet.png` automatically.)

## Workflow

1. **Palette (left).** Every 32×32 cell of the sheet, auto-split.
   Click to select one tile, or **drag to select a rectangular block**
   (multi-tile props, the 2×2 stone floor, a whole wall segment…).
   Give tiles a **logic tag** (wall, floor, door…) — it applies to
   every tile in the selection, and it's what tells the game what a
   painted tile *is*; untagged tiles are art-only and keep whatever the
   generator produced underneath.
2. **Shared layer picker.** The **paint layer** control applies to both
   canvases. Choose **ground** for terrain and **top** for walls or
   objects. Every canvas always shows both layers, while painting,
   picking, clearing, and Smart Paint operate on the selected layer.
   Learning records the examples from both layers when they are present.
3. **Example (upper panel).** Paint a correct patch by hand — a wall with its
   floor, corners and all. `LMB` paints (and drags — strokes are
   gap-free at any speed; multi-tile selections stamp as a repeating
   pattern aligned to the stroke start), `RMB` erases, `Alt`/`MMB`
   picks. Press **Learn rules from example**: the studio records, for
   every tile, which tiles (or emptiness) it touched on each of 8
   sides. The palette inspector shows the selected tile's learned
   north/east/south/west neighbors, so the result is inspectable rather
   than a black box.
4. **Smart paint (lower panel).** Paint **locked seed** tiles (gold pin). A
   backtracking constraint solver ([solver.mjs](solver.mjs), unit
   tests in [solver.test.mjs](solver.test.mjs)) fills the halo around
   your seeds with tiles that satisfy the learned adjacencies. The gold
   pin means “do not replace this tile”; unpinned neighbors were chosen
   by the solver. For example, if your Example shows a wall-base tile
   only with grass directly below it, Smart Paint places that grass under
   every wall-base seed. This works when the wall is painted on the
   **top** layer too: the locked top wall acts as a temporary ground
   constraint while the solver fills its ground support, without copying
   the wall into the exported ground layer. `Re-solve` re-runs
   with fresh randomness; toggle auto-solve off to place many seeds
   first. A failed solve **keeps your grid** and says why; seed tiles
   that never appeared in the example are flagged (they don't
   constrain their neighbors).
5. **Export map JSON** (from the smart or example grid — it trims to
   the painted bounding box). Set **origin** in world-tile coordinates
   first (the default `68,12` is just east of the dev proving ground).

Every paint stroke, clear, import, tag change, and grid resize is reversible
with **Undo** / **Redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`).

Everything autosaves to localStorage (learned rules are re-derived from
the example on reload); **Import JSON** loads an export back in as
seeds and warns if it was drawn on a different sheet.

## Plop it into the game

```
copy custom-map.json packages\client\public\assets\custom-map.json
npm run dev
```

Both sides pick the file up by convention — the game server reads the
same path (override with the `CUSTOM_MAP` env var, or set it to `none`
to disable) and the client fetches `assets/custom-map.json`. They must
see identical files or collision and visuals desync. Walk to the
origin: logic tiles are real (walls collide, doors teleport), and the
art layer renders your exact sheet tiles over the terrain.

`example-map.json` in this directory is a ready-made room to try
(Cainos wall ring, stone floor, safe-room door in the south wall).

## Format (`dc2d-map` v1)

```jsonc
{
  "format": "dc2d-map", "version": 1,
  "tileSize": 32, "sheet": "tilesheet.png", "sheetCols": 32,
  "origin": { "x": 68, "y": 12 },   // world tile of the top-left cell
  "width": 7, "height": 6,
  "logic": [1, 1, null, ...],       // engine TILE ids, null = keep generated
  "art":   [289, 41, null, ...],    // sheet cell index (row*sheetCols+col)
  "flattenTo": 0                     // height inside the stamp
}
```

Validated by `customMapSchema` in `packages/engine/src/world/custommap.ts`.
The client cross-checks `sheetCols` against `atlas.json`'s pack sheet
and warns when a stale map would scramble.
