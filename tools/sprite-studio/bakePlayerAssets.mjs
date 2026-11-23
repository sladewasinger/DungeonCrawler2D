/** Packs exported Blender Holdout player layers + sockets into game-ready sheets & player-rig.json. */
import fs from "node:fs";
import path from "node:path";
import { applyInternalDepthCreases, binarizeAndClean, measureSpriteBounds, shiftSpriteFrame } from "./pixelPost.mjs";
import { decodePng, encodePng } from "./pngCodec.mjs";

const RAW_DIR = process.argv[2];
const OUT_DIR = "D:/repos/dungeoncrawler2D/packages/client/public/assets/player";
const CELL = 144;
const GROUND_Y = 120;
const PX_PER_METER = 48;
const WORLD_SCALE = 16 / PX_PER_METER;
const SHEET_COLS = 6;
const SHEET_ROWS = 36;

const DIRS = ["south", "se", "side", "ne", "north"];
const CLIPS = [
  { state: "idle", frames: 4, fps: 6 },
  { state: "walk", frames: 6, fps: 7 },
  { state: "run", frames: 6, fps: 11 },
  { state: "jump", frames: 2, fps: 8 },
  { state: "fall", frames: 2, fps: 8 },
  { state: "dodge", frames: 6, fps: 16 },
  { state: "downed", frames: 2, fps: 4 },
];

const LAYERS = [
  { id: "body-male", gender: "male" },
  { id: "body-female", gender: "female" },
  { id: "hair-short", gender: "female" },
  { id: "hair-long", gender: "female" },
  { id: "hair-spiky", gender: "female" },
  { id: "hair-ponytail", gender: "female" },
  { id: "armor-head-leather-hood", gender: "female" },
  { id: "armor-chest-leather-tunic-male", gender: "male" },
  { id: "armor-chest-leather-tunic-female", gender: "female" },
  { id: "armor-legs-leather-leggings-male", gender: "male" },
  { id: "armor-legs-leather-leggings-female", gender: "female" },
  { id: "armor-feet-leather-boots", gender: "female" },
];

function loadCleanedFrame({ layerId, clip, dir, frameNum }) {
  const colorPath = path.join(RAW_DIR, layerId, `${clip}_${dir}_f${frameNum}.png`);
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

function packLayerSheet(layer, anchors) {
  const sheetW = SHEET_COLS * CELL;
  const sheetH = SHEET_ROWS * CELL;
  const rgba = new Uint8Array(sheetW * sheetH * 4);
  let row = 0;
  for (const clip of CLIPS) {
    for (const dir of DIRS) {
      const shift = anchors[dir];
      for (let f = 1; f <= clip.frames; f++) {
        const processed = loadCleanedFrame({ layerId: layer.id, clip: clip.state, dir, frameNum: f });
        const aligned = shiftSpriteFrame(processed, shift.dx, shift.dy);
        blitIntoSheet({ sheetRgba: rgba, sheetW, frame: aligned, col: f - 1, row });
      }
      row++;
    }
  }
  const port = loadCleanedFrame({ layerId: layer.id, clip: "portrait", dir: "south", frameNum: 1 });
  const portShift = anchors.south;
  blitIntoSheet({ sheetRgba: rgba, sheetW, frame: shiftSpriteFrame(port, portShift.dx, portShift.dy), col: 0, row: 35 });
  fs.writeFileSync(path.join(OUT_DIR, `${layer.id}.png`), encodePng(sheetW, sheetH, rgba));
}

function convertSocketPoint(pt, shift) {
  return {
    x: Number((((pt.px + shift.dx) - CELL * 0.5) * WORLD_SCALE).toFixed(2)),
    y: Number((((pt.py + shift.dy) - GROUND_Y) * WORLD_SCALE).toFixed(2)),
    behind: Boolean(pt.behind),
  };
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
    portraitRow: 35,
    portraitCol: 0,
    directions: DIRS,
    clips: Object.fromEntries(CLIPS.map((c, idx) => [c.state, { startRow: idx * 5, frames: c.frames, fps: c.fps }])),
    layers: LAYERS.map((l) => l.id),
    sockets: convertSockets(rawSockets, anchorsByGender),
  };
  fs.writeFileSync(path.join(OUT_DIR, "player-rig.json"), JSON.stringify(rigMeta, null, 2) + "\n");
  console.log("Baked player assets:", { outDir: OUT_DIR, layers: LAYERS.length, anchorsByGender });
}

run();
