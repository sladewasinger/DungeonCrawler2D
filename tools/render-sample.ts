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
  WALL_RISE,
  World,
  ZONE,
  chunkCenter,
  hasPlatformCluster,
  hasTerrace,
  hashString,
  platformLootSpots,
  safeRoomChunk,
  terraceSpec,
  type TileType,
  type ZoneType,
} from "@dc2d/engine";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import atlas from "../packages/client/src/render/atlas.json";
import { frameForTile, heightTintFactors } from "../packages/client/src/render/tileframes";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "art-samples");
const TILE_PX = atlas.tileSize;

const sheet = PNG.sync.read(readFileSync(join(ROOT, "packages", "client", "public", "assets", "tiles.png")));
const COLS = Math.floor(sheet.width / TILE_PX);

function stampFrame(dst: PNG, dx: number, dy: number, frame: number, tintH: number | null): void {
  const sx = (frame % COLS) * TILE_PX;
  const sy = Math.floor(frame / COLS) * TILE_PX;
  // same elevation tint the live client applies per tile
  const tint = tintH === null ? [1, 1, 1] : heightTintFactors(tintH);
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
        const v = sheet.data[si + c]! * tint[c]!;
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
      // wall caps render half a tile north (row-major order keeps them
      // over the previous row, same as the live caps layer)
      if (f.cap >= 0) stampFrame(img, tx * TILE_PX, ty * TILE_PX - TILE_PX / 2, f.cap, f.capTintHeight);
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
  heightAt(wx, wy) {
    // walls are raised terrain now — the showcase demos the faces too
    return showcaseWorld.tileAt(wx, wy) === TILE.Wall ? WALL_RISE : 0;
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

// a ruin platform cluster (jumpable mesas + loot spots)
{
  let found: [number, number] | null = null;
  outer: for (let cy = 2; cy < 12 && !found; cy++) {
    for (let cx = 2; cx < 12; cx++) {
      if (hasPlatformCluster(world.worldSeed, world.floor, cx, cy)) {
        found = [cx, cy];
        break outer;
      }
    }
  }
  if (found) {
    const spots = platformLootSpots(world.worldSeed, world.floor, found[0], found[1]);
    const cx = spots.length > 0 ? Math.round(spots[0]!.x) : found[0] * CHUNK_SIZE + 16;
    const cy = spots.length > 0 ? Math.round(spots[0]!.y) : found[1] * CHUNK_SIZE + 16;
    render(world, cx - 13, cy - 13, 26, 26, "platforms.png");
  }
}

// a raised section: hard ledges all around, staircase entries on the corridor
{
  let found: [number, number] | null = null;
  outer: for (let cy = 2; cy < 12 && !found; cy++) {
    for (let cx = 2; cx < 12; cx++) {
      if (hasTerrace(world.worldSeed, world.floor, cx, cy)) {
        found = [cx, cy];
        break outer;
      }
    }
  }
  if (found) {
    const spec = terraceSpec(world.worldSeed, world.floor, found[0], found[1])!;
    const tx = found[0] * CHUNK_SIZE + spec.lx;
    const ty = found[1] * CHUNK_SIZE + spec.ly;
    render(
      world,
      tx - spec.hx - 3,
      ty - spec.hy - 3,
      spec.hx * 2 + 7,
      spec.hy * 2 + 7,
      "terrace.png",
    );
  }
}

// wild plateau cliffs + corridor ramps (the climb routes must read)
{
  // scan for the region with the widest height range near a corridor
  let best: [number, number] = [3, 3];
  let bestRange = -1;
  for (let cy = 2; cy < 10; cy++) {
    for (let cx = 2; cx < 10; cx++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let t = 0; t < CHUNK_SIZE; t += 2) {
        const c = chunkCenter(world.worldSeed, world.floor, cx, cy);
        const h = world.heightAt(Math.round(c.x) - CHUNK_SIZE / 2 + t, Math.round(c.y));
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      if (hi - lo > bestRange) {
        bestRange = hi - lo;
        best = [cx, cy];
      }
    }
  }
  const c = chunkCenter(world.worldSeed, world.floor, best[0], best[1]);
  render(world, Math.round(c.x) - 14, Math.round(c.y) - 12, 28, 24, "wild-cliffs.png");
}
