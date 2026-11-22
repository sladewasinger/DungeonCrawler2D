/** CLI baker turning Blender turntable color+depth frames into a game-ready Cainos sel-out spritesheet. */
import fs from "node:fs";
import path from "node:path";
import { postProcessFrame, measureSpriteBounds } from "./pixelPost.mjs";
import { decodePng, encodePng } from "./pngCodec.mjs";

const DIRS = ["south", "side", "north"];

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
    outCreatures: opt("outCreatures", "D:/repos/dungeoncrawler2D/packages/client/public/assets/creatures"),
    reviewPath: opt("reviewPath", ""),
    frames: Number(opt("frames", "6")),
    groundY: Number(opt("groundY", "52")),
  };
}

function processDirectionClip(opts) {
  const { rawDir, dir, clip, frames, groundY } = opts;
  const rawFrames = [];
  const processed = [];
  let anchorShift = null;
  for (let f = 1; f <= frames; f++) {
    const colorImg = decodePng(fs.readFileSync(path.join(rawDir, `${dir}_${clip}_f${f}.png`)));
    const depthFile = path.join(rawDir, `${dir}_${clip}_f${f}_depth.png`);
    const depthImg = fs.existsSync(depthFile) ? decodePng(fs.readFileSync(depthFile)) : null;
    rawFrames.push(colorImg);
    const res = postProcessFrame({ colorImg, depthImg, groundY, dx: anchorShift?.dx, dy: anchorShift?.dy });
    anchorShift ??= { dx: res.dx, dy: res.dy };
    processed.push(res.frame);
  }
  return { rawFrames, processed };
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
  const cols = rows[0].length;
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
  const rgb = combined.rgba[sp + 3] > 0
    ? [combined.rgba[sp], combined.rgba[sp + 1], combined.rgba[sp + 2]]
    : resolveBackdropRgb({ sx, sy, cellW, cellH, groundY });
  out[dp] = rgb[0]; out[dp + 1] = rgb[1]; out[dp + 2] = rgb[2]; out[dp + 3] = 255;
}

function writeReviewContactSheet(opts) {
  const { rawRows, postRows, cellW, cellH, groundY, reviewPath } = opts;
  if (!reviewPath) return;
  const combined = packRows([...rawRows, ...postRows], cellW, cellH);
  const zoom = 4;
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

function run() {
  const args = parseCliArgs(process.argv.slice(2));
  const rawRows = [];
  const postRows = [];
  for (const dir of DIRS) {
    const res = processDirectionClip({ rawDir: args.rawDir, dir, clip: args.clip, frames: args.frames, groundY: args.groundY });
    rawRows.push(res.rawFrames);
    postRows.push(res.processed);
  }
  const cellW = postRows[0][0].width;
  const cellH = postRows[0][0].height;
  const sheet = packRows(postRows, cellW, cellH);
  fs.mkdirSync(args.outCreatures, { recursive: true });
  fs.writeFileSync(path.join(args.outCreatures, `${args.creature}-sheet.png`), encodePng(sheet.width, sheet.height, sheet.rgba));
  fs.writeFileSync(path.join(args.outCreatures, `${args.creature}.png`), encodePng(cellW, cellH, postRows[0][0].rgba));
  writeReviewContactSheet({ rawRows, postRows, cellW, cellH, groundY: args.groundY, reviewPath: args.reviewPath });
  const bounds = measureSpriteBounds(postRows[0][0]);
  console.log({ creature: args.creature, cell: `${cellW}x${cellH}`, sheet: `${sheet.width}x${sheet.height}`, bounds });
}

run();
