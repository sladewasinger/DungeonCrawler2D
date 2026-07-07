# Tile Studio

A small in-browser map editor for the Craftpix pack (or any tile
sheet), in the spirit of Godot's TileMap editor: pick tiles from an
auto-split palette, paint an example, let the studio learn which tiles
may touch, then paint with auto-completing borders — and export a map
the game can stamp straight over dungeon generation.

## Run it

```
npm run studio
```

(vite serves the repo statically and opens `tools/tile-studio/`; the
pack sheet loads from `assets/pack/walls_floor.png` automatically.)

## Workflow

1. **Palette (left).** Every 16×16 cell of the sheet, auto-split.
   Click to select. Give tiles a **logic tag** (wall, floor, door…) —
   that's what tells the game what a painted tile *is*; untagged tiles
   are art-only and keep whatever the generator produced underneath.
2. **Example (top).** Paint a correct patch by hand — a wall with its
   floor, corners and all. `LMB` paint, `RMB` erase, `Alt`/`MMB` pick.
   Press **Learn rules from example**: the studio records, for every
   tile, which tiles (or emptiness) it touched on each side.
3. **Smart paint (bottom).** Paint seed tiles (gold pip). A WFC-style
   constraint solver fills the halo around your seeds with tiles that
   satisfy the learned adjacencies — paint a blob of wall interior and
   the borders appear on their own. `Re-solve` re-runs it; toggle
   auto-solve off if you want to place many seeds first.
4. **Export map JSON** (from the smart or example grid — it trims to
   the painted bounding box). Set **origin** in world-tile coordinates
   first (the default `68,12` is just east of the dev proving ground).

Everything autosaves to localStorage; **Import JSON** loads an export
back in as seeds.

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

`example-map.json` in this directory is a ready-made room to try.

## Format (`dc2d-map` v1)

```jsonc
{
  "format": "dc2d-map", "version": 1,
  "tileSize": 16, "sheet": "walls_floor.png", "sheetCols": 13,
  "origin": { "x": 68, "y": 12 },   // world tile of the top-left cell
  "width": 5, "height": 4,
  "logic": [1, 1, null, ...],       // engine TILE ids, null = keep generated
  "art":   [14, 284, null, ...],    // sheet cell index (row*sheetCols+col)
  "flattenTo": 0                     // height inside the stamp
}
```

Validated by `customMapSchema` in `packages/engine/src/world/custommap.ts`.
