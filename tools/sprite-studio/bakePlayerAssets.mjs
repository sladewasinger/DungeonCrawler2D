/** Packs exported Blender Holdout player layers + sockets into game-ready sheets & player-rig.json. */
import fs from "node:fs";
import path from "node:path";
import { applyInternalDepthCreases, binarizeAndClean, measureSpriteBounds, shiftSpriteFrame } from "./pixelPost.mjs";
import { decodePng, encodePng } from "./pngCodec.mjs";

const RAW_DIR = process.argv[2];
const OUT_DIR = "D:/repos/dungeoncrawler2D/packages/client/public/assets/player";
const CELL = 192;
const GROUND_Y = 148;
const PX_PER_METER = 80;
const WORLD_SCALE = 16 / PX_PER_METER;
const SHEET_COLS = 6;
const SHEET_ROWS = 41;

const DIRS = ["south", "se", "side", "ne", "north"];
const CLIPS = [
  { state: "idle", frames: 4, fps: 6 },
  { state: "walk", frames: 6, fps: 7 },
  { state: "run", frames: 6, fps: 11 },
  { state: "jump", frames: 2, fps: 8 },
  { state: "fall", frames: 2, fps: 8 },
  { state: "dodge", frames: 6, fps: 16 },
  { state: "downed", frames: 2, fps: 4 },
  { state: "swim", frames: 4, fps: 6 },
];

const LAYERS = [
  { id: "body-male", gender: "male" },
  { id: "body-female", gender: "female" },
  { id: "body-male-arms", gender: "male" },
  { id: "body-female-arms", gender: "female" },
  { id: "hair-short", gender: "female" },
  { id: "hair-long", gender: "female" },
  { id: "hair-spiky", gender: "female" },
  { id: "hair-ponytail", gender: "female" },
  { id: "armor-head-leather-hood", gender: "female" },
  { id: "armor-chest-leather-tunic-male", gender: "male" },
  { id: "armor-chest-leather-tunic-female", gender: "female" },
  { id: "armor-chest-sleeves-male", gender: "male" },
  { id: "armor-chest-sleeves-female", gender: "female" },
  { id: "armor-legs-leather-leggings-male", gender: "male" },
  { id: "armor-legs-leather-leggings-female", gender: "female" },
  { id: "armor-feet-leather-boots", gender: "female" },
];

function loadCleanedFrame({ layerId, clip, dir, frameNum }) {
  const colorPath = path.join(RAW_DIR, layerId, `${clip}_${dir}_f${frameNum}.png`);
  if (!fs.existsSync(colorPath)) return null;
  const depthPath = path.join(RAW_DIR, layerId, `${clip}_${dir}_f${frameNum}_depth.png`);
  const rawColor = decodePng(fs.readFileSync(colorPath));
  const rawDepth = fs.existsSync(depthPath) ? decodePng(fs.readFileSync(depthPath)) : null;
  const clean = binarizeAndClean(rawColor, 4);
  return rawDepth ? applyInternalDepthCreases(clean, rawDepth, 16) : clean;
}

function computeBodyAnchors(bodyId) {
  const anchors = {};
  for (const dir of DIRS) {
    const idleF1 = loadCleanedFrame({ layerId: bodyId, clip: "idle", dir, frameNum: 1 });
    if (!idleF1) throw new Error(`Missing anchor frame for ${bodyId} ${dir}`);
    const bounds = measureSpriteBounds(idleF1);
    const dx = Math.floor(CELL / 2) - Math.round((bounds.minX + bounds.maxX) * 0.5);
    const dy = GROUND_Y - bounds.maxY;
    anchors[dir] = { dx, dy };
  }
  return anchors;
}

function blitIntoSheet({ sheetRgba, sheetW, frame, col, row }) {
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const sp = (y * CELL + x) * 4;
      if (frame.rgba[sp + 3] === 0) continue;
      const dp = ((row * CELL + y) * sheetW + (col * CELL + x)) * 4;
      sheetRgba[dp] = frame.rgba[sp];
      sheetRgba[dp + 1] = frame.rgba[sp + 1];
      sheetRgba[dp + 2] = frame.rgba[sp + 2];
      sheetRgba[dp + 3] = frame.rgba[sp + 3];
    }
  }
}

function updateSheetExtremes(ext, bounds) {
  if (bounds.contentWidth === 0) return;
  ext.minX = Math.min(ext.minX, bounds.minX);
  ext.minY = Math.min(ext.minY, bounds.minY);
  ext.maxX = Math.max(ext.maxX, bounds.maxX);
  ext.maxY = Math.max(ext.maxY, bounds.maxY);
}

function packFrameCell(opts) {
  const processed = loadCleanedFrame({ layerId: opts.layerId, clip: opts.clip, dir: opts.dir, frameNum: opts.frameNum });
  if (!processed) return;
  const aligned = shiftSpriteFrame(processed, opts.shift.dx, opts.shift.dy);
  if (opts.ext) updateSheetExtremes(opts.ext, measureSpriteBounds(aligned));
  blitIntoSheet({ sheetRgba: opts.rgba, sheetW: opts.sheetW, frame: aligned, col: opts.col, row: opts.row });
}

function packClipDir(opts) {
  for (let f = 1; f <= opts.clip.frames; f++) {
    packFrameCell({
      rgba: opts.rgba, sheetW: opts.sheetW, layerId: opts.layerId, clip: opts.clip.state,
      dir: opts.dir, frameNum: f, shift: opts.shift, col: f - 1, row: opts.row, ext: opts.ext,
    });
  }
}

function packLayerSheet(layer, anchors) {
  const sheetW = SHEET_COLS * CELL;
  const sheetH = SHEET_ROWS * CELL;
  const rgba = new Uint8Array(sheetW * sheetH * 4);
  const trackBounds = layer.id === "body-male" || layer.id === "hair-ponytail";
  const ext = trackBounds ? { minX: CELL, minY: CELL, maxX: -1, maxY: -1 } : null;
  let row = 0;
  for (const clip of CLIPS) {
    for (const dir of DIRS) {
      packClipDir({ rgba, sheetW, layerId: layer.id, clip, dir, shift: anchors[dir], row, ext });
      row++;
    }
  }
  packFrameCell({ rgba, sheetW, layerId: layer.id, clip: "portrait", dir: "south", frameNum: 1, shift: anchors.south, col: 0, row: 40, ext });
  if (ext) console.log(`Layer ${layer.id} cell bounds (@${CELL}px):`, ext);
  fs.writeFileSync(path.join(OUT_DIR, `${layer.id}.png`), encodePng(sheetW, sheetH, rgba));
}

function convertSocketPoint(pt, shift) {
  const out = {
    x: Number((((pt.px + shift.dx) - CELL * 0.5) * WORLD_SCALE).toFixed(2)),
    y: Number((((pt.py + shift.dy) - GROUND_Y) * WORLD_SCALE).toFixed(2)),
    behind: Boolean(pt.behind),
  };
  if (typeof pt.angle === "number") out.angle = Number(pt.angle.toFixed(4));
  return out;
}

function convertDirSockets(rawClip, anchors) {
  const clipOut = {};
  for (const dir of DIRS) {
    const shift = anchors[dir];
    clipOut[dir] = rawClip[dir].map((s) => ({
      left: convertSocketPoint(s.left, shift),
      right: convertSocketPoint(s.right, shift),
    }));
  }
  return clipOut;
}

function convertSockets(rawSockets, anchorsByGender) {
  const out = {};
  for (const gender of ["male", "female"]) {
    const anchors = anchorsByGender[gender];
    out[gender] = {};
    for (const clip of CLIPS) {
      const rawClip = rawSockets[gender]?.[clip.state];
      if (rawClip) out[gender][clip.state] = convertDirSockets(rawClip, anchors);
    }
  }
  return out;
}

function run() {
  if (!RAW_DIR) throw new Error("Usage: node bakePlayerAssets.mjs <rawDir>");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const anchorsByGender = {
    male: computeBodyAnchors("body-male"),
    female: computeBodyAnchors("body-female"),
  };
  for (const layer of LAYERS) {
    packLayerSheet(layer, anchorsByGender[layer.gender]);
  }
  const rawSockets = JSON.parse(fs.readFileSync(path.join(RAW_DIR, "raw_sockets.json"), "utf8"));
  const rigMeta = {
    frameWidth: CELL,
    frameHeight: CELL,
    cols: SHEET_COLS,
    rows: SHEET_ROWS,
    groundY: GROUND_Y,
    anchorX: 0.5,
    anchorY: Number((GROUND_Y / CELL).toFixed(4)),
    scale: Number(WORLD_SCALE.toFixed(4)),
    portraitRow: 40,
    portraitCol: 0,
    directions: DIRS,
    clips: Object.fromEntries(CLIPS.map((c, idx) => [c.state, { startRow: idx * 5, frames: c.frames, fps: c.fps }])),
    layers: LAYERS.map((l) => l.id),
    bakeVersion: Date.now(),
    sockets: convertSockets(rawSockets, anchorsByGender),
    handSockets: rawSockets.handSockets ? convertSockets(rawSockets.handSockets, anchorsByGender) : undefined,
  };
  fs.writeFileSync(path.join(OUT_DIR, "player-rig.json"), JSON.stringify(rigMeta, null, 2) + "\n");
  console.log("Baked player assets:", { outDir: OUT_DIR, layers: LAYERS.length, anchorsByGender });
}

run();
