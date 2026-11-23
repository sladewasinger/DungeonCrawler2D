/** CLI baker turning Blender turntable color+depth frames into a game-ready Cainos sel-out spritesheet. */
import fs from "node:fs";
import path from "node:path";
import { updateCreatureManifest } from "./manifestSync.mjs";
import { postProcessFrame, measureSpriteBounds } from "./pixelPost.mjs";
import { decodePng, encodePng } from "./pngCodec.mjs";

const DEFAULT_CREATURES_DIR = "D:/repos/dungeoncrawler2D/packages/client/public/assets/creatures";
const DEFAULT_MANIFEST = "D:/repos/dungeoncrawler2D/packages/client/public/assets/sprite-manifest.json";

function readFlagMap(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length - 1; i += 2) {
    if (argv[i].startsWith("--")) map.set(argv[i].slice(2), argv[i + 1]);
  }
  return map;
}

function parseCliArgs(argv) {
  const map = readFlagMap(argv);
  const opt = (key, fallback) => map.get(key) ?? fallback;
  return {
    creature: opt("creature", "goblin"),
    clip: opt("clip", "idle"),
    rawDir: opt("rawDir", ""),
    outCreatures: opt("outCreatures", DEFAULT_CREATURES_DIR),
    manifestPath: opt("manifestPath", DEFAULT_MANIFEST),
    reviewPath: opt("reviewPath", ""),
    frames: Number(opt("frames", "6")),
    groundY: map.has("groundY") ? Number(map.get("groundY")) : null,
  };
}

function loadClipsMetadata(args) {
  const metaFile = path.join(args.rawDir, "clips.json");
  if (!fs.existsSync(metaFile)) {
    return {
      directions: ["south", "side", "north"],
      clips: [{ state: args.clip, frameCount: args.frames, fps: 7 }],
    };
  }
  return JSON.parse(fs.readFileSync(metaFile, "utf8"));
}

function processDirectionClip(opts) {
  const { rawDir, dir, state, frameCount, groundY, baseAnchor, minIslandArea, bodyAlpha, outlineRadius } = opts;
  const rawFrames = [];
  const processed = [];
  let anchorShift = baseAnchor ?? null;
  for (let f = 1; f <= frameCount; f++) {
    const colorImg = decodePng(fs.readFileSync(path.join(rawDir, `${dir}_${state}_f${f}.png`)));
    const depthFile = path.join(rawDir, `${dir}_${state}_f${f}_depth.png`);
    const depthImg = fs.existsSync(depthFile) ? decodePng(fs.readFileSync(depthFile)) : null;
    rawFrames.push(colorImg);
    const res = postProcessFrame({
      colorImg, depthImg, groundY, minIslandArea, bodyAlpha, outlineRadius,
      dx: anchorShift?.dx, dy: anchorShift?.dy,
    });
    anchorShift ??= { dx: res.dx, dy: res.dy };
    processed.push(res.frame);
  }
  return { rawFrames, processed, anchorShift };
}

function blitCell(opts) {
  const { dstRgba, dstW, cellRgba, cellW, cellH, col, row } = opts;
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const sp = (y * cellW + x) * 4;
      const dp = ((row * cellH + y) * dstW + (col * cellW + x)) * 4;
      dstRgba[dp] = cellRgba[sp]; dstRgba[dp + 1] = cellRgba[sp + 1];
      dstRgba[dp + 2] = cellRgba[sp + 2]; dstRgba[dp + 3] = cellRgba[sp + 3];
    }
  }
}

function packRows(rows, cellW, cellH) {
  const cols = rows.reduce((maxCols, r) => Math.max(maxCols, r.length), 1);
  const sheetW = cols * cellW;
  const sheetH = rows.length * cellH;
  const rgba = new Uint8Array(sheetW * sheetH * 4);
  rows.forEach((rowCells, row) => {
    rowCells.forEach((cell, col) => blitCell({ dstRgba: rgba, dstW: sheetW, cellRgba: cell.rgba, cellW, cellH, col, row }));
  });
  return { width: sheetW, height: sheetH, rgba };
}

function resolveBackdropRgb(opts) {
  const { sx, sy, cellW, cellH, groundY } = opts;
  if (sx % cellW === 0 || sy % cellH === 0) return [24, 38, 48];
  if (sy % cellH === groundY) return [140, 170, 92];
  const chk = ((Math.floor(sx / 16) + Math.floor(sy / 16)) & 1) === 0;
  return chk ? [62, 108, 58] : [76, 126, 70];
}

function paintReviewPixel(opts) {
  const { combined, out, rw, zoom, x, y, cellW, cellH, groundY } = opts;
  const sx = Math.floor(x / zoom);
  const sy = Math.floor(y / zoom);
  const sp = (sy * combined.width + sx) * 4;
  const dp = (y * rw + x) * 4;
  const bg = resolveBackdropRgb({ sx, sy, cellW, cellH, groundY });
  const a = combined.rgba[sp + 3] / 255;
  out[dp] = Math.round(bg[0] * (1 - a) + combined.rgba[sp] * a);
  out[dp + 1] = Math.round(bg[1] * (1 - a) + combined.rgba[sp + 1] * a);
  out[dp + 2] = Math.round(bg[2] * (1 - a) + combined.rgba[sp + 2] * a);
  out[dp + 3] = 255;
}

function writeReviewContactSheet(opts) {
  const { rows, cellW, cellH, groundY, reviewPath } = opts;
  if (!reviewPath) return;
  const combined = packRows(rows, cellW, cellH);
  const zoom = cellW >= 120 ? 2 : cellW >= 96 ? 3 : 4;
  const rw = combined.width * zoom;
  const rh = combined.height * zoom;
  const out = new Uint8Array(rw * rh * 4);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      paintReviewPixel({ combined, out, rw, zoom, x, y, cellW, cellH, groundY });
    }
  }
  fs.writeFileSync(reviewPath, encodePng(rw, rh, out));
}

function bakeDirectionRow(opts) {
  const { args, state, frameCount, dir, anchorsByDir } = opts;
  const isCorpse = state === "corpse";
  const baseAnchor = isCorpse ? null : anchorsByDir.get(dir);
  const res = processDirectionClip({
    rawDir: args.rawDir, dir, state, frameCount,
    groundY: args.groundY, minIslandArea: args.minIslandArea, bodyAlpha: args.bodyAlpha,
    outlineRadius: args.outlineRadius, baseAnchor,
  });
  if (!isCorpse && !anchorsByDir.has(dir)) anchorsByDir.set(dir, res.anchorShift);
  return res.processed;
}

function bakeAllClips(args, meta) {
  const postRows = [];
  const anchorsByDir = new Map();
  const clipEntries = [];
  for (const clip of meta.clips) {
    const dirs = clip.state === "corpse" ? ["south"] : meta.directions;
    const rowsMap = new Map();
    for (const dir of dirs) {
      rowsMap.set(dir, postRows.length);
      postRows.push(bakeDirectionRow({ args, state: clip.state, frameCount: clip.frameCount, dir, anchorsByDir }));
    }
    clipEntries.push({ ...clip, rows: rowsMap });
  }
  return { postRows, clipEntries };
}

function run() {
  const args = parseCliArgs(process.argv.slice(2));
  const meta = loadClipsMetadata(args);
  const pxPerMeter = Number(meta.pxPerMeter ?? 32);
  const scale = Number((16 / pxPerMeter).toFixed(4));
  const minIslandArea = Math.max(4, Math.round(4 * (pxPerMeter / 32)));
  const outlineRadius = Math.max(1.5, Math.round(2 * (pxPerMeter / 48)));
  const bodyAlpha = Number(meta.bodyAlpha ?? 1.0);
  const resolvedGroundY = args.groundY ?? meta.groundY ?? Math.round((meta.cellPx ?? 64) * 0.8125);
  const effectiveArgs = { ...args, groundY: resolvedGroundY, minIslandArea, bodyAlpha, outlineRadius };
  const { postRows, clipEntries } = bakeAllClips(effectiveArgs, meta);
  const cellW = postRows[0][0].width;
  const cellH = postRows[0][0].height;
  const sheet = packRows(postRows, cellW, cellH);
  fs.mkdirSync(args.outCreatures, { recursive: true });
  fs.writeFileSync(path.join(args.outCreatures, `${args.creature}-sheet.png`), encodePng(sheet.width, sheet.height, sheet.rgba));
  fs.writeFileSync(path.join(args.outCreatures, `${args.creature}.png`), encodePng(cellW, cellH, postRows[0][0].rgba));
  writeReviewContactSheet({ rows: postRows, cellW, cellH, groundY: resolvedGroundY, reviewPath: args.reviewPath });
  const idleBounds = measureSpriteBounds(postRows[0][0]);
  updateCreatureManifest({
    manifestPath: args.manifestPath, creature: args.creature, cellW, cellH, idleBounds,
    groundY: resolvedGroundY, scale, clipEntries, directions: meta.directions,
  });
  console.log({ creature: args.creature, cell: `${cellW}x${cellH}`, groundY: resolvedGroundY, pxPerMeter, scale, sheet: `${sheet.width}x${sheet.height}`, rows: postRows.length, bounds: idleBounds });
}

run();
