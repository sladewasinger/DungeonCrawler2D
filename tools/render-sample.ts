/**
 * Renders proof-image samples of the terrain art into docs/art-samples/,
 * using the exact same frame selection as the live client (tileframes.ts).
 *
 *   npx tsx tools/render-sample.ts
 *
 * Outputs:
 *   showcase.png  — hand-built map exercising every wall autotile case
 *   safe-room.png — the dev proving-ground safe pad (real worldgen)
 *   cave.png      — natural cave walls from worldgen
 */
import {
  CHUNK_SIZE,
  TILE,
  World,
  ZONE,
  hashString,
  safeRoomChunk,
  type TileType,
  type ZoneType,
} from "@dc2d/engine";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import atlas from "../packages/client/src/render/atlas.json";
import { frameForTile } from "../packages/client/src/render/tileframes";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "art-samples");
const TILE_PX = atlas.tileSize;

const sheet = PNG.sync.read(readFileSync(join(ROOT, "packages", "client", "public", "assets", "tiles.png")));
const COLS = Math.floor(sheet.width / TILE_PX);

function heightBrightness(h: number): number {
  // must match heightTint in DungeonScene.ts
  return Math.max(0.5, Math.min(1, 0.95 + h * 0.035));
}

function stampFrame(dst: PNG, dx: number, dy: number, frame: number, tintH: number | null): void {
  const sx = (frame % COLS) * TILE_PX;
  const sy = Math.floor(frame / COLS) * TILE_PX;
  const b = tintH === null ? 1 : heightBrightness(tintH);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const si = ((sy + y) * sheet.width + sx + x) * 4;
      const a = sheet.data[si + 3]! / 255;
      if (a === 0) continue;
      const di = ((dy + y) * dst.width + dx + x) * 4;
      if (dst.data[di + 3] === 0) {
        // scene background behind the tilemap is near-black
        dst.data[di] = 12;
        dst.data[di + 1] = 12;
        dst.data[di + 2] = 16;
      }
      for (let c = 0; c < 3; c++) {
        const v = sheet.data[si + c]! * b;
        dst.data[di + c] = Math.round(v * a + dst.data[di + c]! * (1 - a));
      }
      dst.data[di + 3] = 255;
    }
  }
}

interface WorldLike {
  tileAt(wx: number, wy: number): TileType;
  heightAt(wx: number, wy: number): number;
  zoneAt(wx: number, wy: number): ZoneType;
}

function render(world: WorldLike, x0: number, y0: number, w: number, h: number, file: string): void {
  const img = new PNG({ width: w * TILE_PX, height: h * TILE_PX });
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const f = frameForTile(world as World, x0 + tx, y0 + ty);
      stampFrame(img, tx * TILE_PX, ty * TILE_PX, f.base, f.baseTintHeight);
      if (f.border >= 0) stampFrame(img, tx * TILE_PX, ty * TILE_PX, f.border, null);
      if (f.overlay >= 0) stampFrame(img, tx * TILE_PX, ty * TILE_PX, f.overlay, f.overlayTintHeight);
    }
  }
  writeFileSync(join(OUT, file), PNG.sync.write(img));
  console.log(`wrote docs/art-samples/${file} (${img.width}x${img.height})`);
}

// ── showcase: hand-built map covering every wall case ──────────────
// # wall  . floor  s sanctuary  P/Y doors  T table  H stash
const SHOWCASE = [
  "........................",
  ".####......#....#..#....",
  ".####......#....####....",
  ".####......#............",
  ".####......#....######..",
  "...........#............",
  "..............#.........",
  ".#########....#.....##..",
  ".#.......#....#.....##..",
  ".#.sssss.#....#.........",
  ".#.sssss.#..............",
  ".#.sssTs.#.....#######..",
  ".#.sssss.#.....#######..",
  ".#.ssHss.#.....#######..",
  ".####P####...............",
  ".........................",
];

const showcaseWorld: WorldLike = {
  tileAt(wx, wy) {
    const row = SHOWCASE[wy];
    const ch = row?.[wx];
    if (ch === undefined) return TILE.Floor as TileType;
    switch (ch) {
      case "#": return TILE.Wall as TileType;
      case "P": return TILE.DoorPersonal as TileType;
      case "Y": return TILE.DoorParty as TileType;
      case "T": return TILE.CraftingTable as TileType;
      case "H": return TILE.Stash as TileType;
      default: return TILE.Floor as TileType;
    }
  },
  heightAt() {
    return 0;
  },
  zoneAt(wx, wy) {
    const ch = SHOWCASE[wy]?.[wx];
    return (ch === "s" || ch === "T" || ch === "H" ? ZONE.Sanctuary : ZONE.Open) as ZoneType;
  },
};

mkdirSync(OUT, { recursive: true });
render(showcaseWorld, 0, 0, 24, 16, "showcase.png");

// ── real worldgen ──────────────────────────────────────────────────

const world = new World(hashString("e2e-world"), 1);
// dev proving ground: the safe-room entrance kiosk and its clearing
render(world, 44, 42, 22, 22, "safe-room-entrance.png");

// the instanced safe room behind the proving-ground door (chunk 1,1)
{
  const room = safeRoomChunk(1, 1);
  render(world, room.cx * CHUNK_SIZE + 5, room.cy * CHUNK_SIZE + 8, 22, 16, "safe-room.png");
}

// natural cave walls away from the test zone
{
  // scan for a chunk with a good mix of wall and floor
  let best: [number, number] = [5, 5];
  let bestScore = -1;
  for (let cy = 4; cy < 9; cy++) {
    for (let cx = 4; cx < 9; cx++) {
      let walls = 0;
      for (let ty = 0; ty < CHUNK_SIZE; ty++) {
        for (let tx = 0; tx < CHUNK_SIZE; tx++) {
          if (world.tileAt(cx * CHUNK_SIZE + tx, cy * CHUNK_SIZE + ty) === TILE.Wall) walls++;
        }
      }
      const frac = walls / (CHUNK_SIZE * CHUNK_SIZE);
      const score = 1 - Math.abs(frac - 0.45);
      if (score > bestScore) {
        bestScore = score;
        best = [cx, cy];
      }
    }
  }
  render(world, best[0] * CHUNK_SIZE, best[1] * CHUNK_SIZE, 24, 20, "cave.png");
}
