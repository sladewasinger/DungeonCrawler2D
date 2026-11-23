/** Packs exported Blender Holdout player layers + sockets into game-ready sheets & player-rig.json. */
import fs from "node:fs";
import path from "node:path";
import { applyInternalDepthCreases, applyOuterSelOut, binarizeAndClean, measureSpriteBounds, shiftSpriteFrame } from "./pixelPost.mjs";
import { decodePng, encodePng } from "./pngCodec.mjs";

const OUT_DIR = "D:/repos/dungeoncrawler2D/packages/client/public/assets/player";
const RIG_META_PATH = path.join(OUT_DIR, "player-rig.json");
const CELL = 192;
const GROUND_Y = 148;
const PX_PER_METER = 80;
const WORLD_SCALE = 16 / PX_PER_METER;
const SHEET_COLS = 6;

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
  { state: "bow", frames: 3, fps: 8 },
  { state: "crouch_idle", frames: 4, fps: 5 },
  { state: "crouch_walk", frames: 6, fps: 7 },
  { state: "attack", frames: 3, fps: 10 },
];
const PORTRAIT_ROW = CLIPS.length * DIRS.length;
const SHEET_ROWS = PORTRAIT_ROW + 1;

const BODY_MALE = "body-male";
const BODY_FEMALE = "body-female";

const LAYERS = [
  { id: BODY_MALE, gender: "male" },
  { id: BODY_FEMALE, gender: "female" },
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

function parseCliArgs(argv) {
  const rawDir = argv[0];
  if (!rawDir || rawDir.startsWith("--")) throw new Error("Usage: node bakePlayerAssets.mjs <rawDir> [--layers <csv>] [--bow-only]");
  let onlyLayers = null;
  let bowOnly = false;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--layers" && i + 1 < argv.length) onlyLayers = new Set(argv[++i].split(",").map((s) => s.trim()).filter(Boolean));
    else if (argv[i] === "--bow-only") bowOnly = true;
  }
  return { rawDir, onlyLayers, bowOnly };
}

function loadCleanedFrame({ rawDir, layerId, clip, dir, frameNum }) {
  const colorPath = path.join(rawDir, layerId, `${clip}_${dir}_f${frameNum}.png`);
  if (!fs.existsSync(colorPath)) return null;
  const depthPath = path.join(rawDir, layerId, `${clip}_${dir}_f${frameNum}_depth.png`);
  const rawColor = decodePng(fs.readFileSync(colorPath));
  const rawDepth = fs.existsSync(depthPath) ? decodePng(fs.readFileSync(depthPath)) : null;
  const clean = binarizeAndClean(rawColor, 4);
  return rawDepth ? applyInternalDepthCreases(clean, rawDepth, 16) : clean;
}

function computeBodyAnchors(rawDir, bodyId) {
  const anchors = {};
  for (const dir of DIRS) {
    const idleF1 = loadCleanedFrame({ rawDir, layerId: bodyId, clip: "idle", dir, frameNum: 1 });
    if (!idleF1) throw new Error(`Missing anchor frame for ${bodyId} ${dir}`);
    const bounds = measureSpriteBounds(idleF1);
    const dx = Math.floor(CELL / 2) - Math.round((bounds.minX + bounds.maxX) * 0.5);
    const dy = GROUND_Y - bounds.maxY;
    anchors[dir] = { dx, dy };
  }
  return anchors;
}

function hasAnchorFrames(rawDir, bodyId) {
  return DIRS.every((dir) => fs.existsSync(path.join(rawDir, bodyId, `idle_${dir}_f1.png`)));
}

function resolveGenderAnchors({ rawDir, bodyId, prevAnchors }) {
  if (hasAnchorFrames(rawDir, bodyId)) return computeBodyAnchors(rawDir, bodyId);
  return prevAnchors ?? null;
}

function resolveAnchorsByGender(rawDir, prevMeta) {
  return {
    male: resolveGenderAnchors({ rawDir, bodyId: BODY_MALE, prevAnchors: prevMeta?.anchorsByGender?.male }),
    female: resolveGenderAnchors({ rawDir, bodyId: BODY_FEMALE, prevAnchors: prevMeta?.anchorsByGender?.female }),
  };
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
  const processed = loadCleanedFrame({ rawDir: opts.rawDir, layerId: opts.layerId, clip: opts.clip, dir: opts.dir, frameNum: opts.frameNum });
  if (!processed) return;
  const aligned = shiftSpriteFrame(processed, opts.shift.dx, opts.shift.dy);
  if (opts.ext) updateSheetExtremes(opts.ext, measureSpriteBounds(aligned));
  blitIntoSheet({ sheetRgba: opts.rgba, sheetW: opts.sheetW, frame: aligned, col: opts.col, row: opts.row });
}

function packClipDir(opts) {
  for (let f = 1; f <= opts.clip.frames; f++) {
    packFrameCell({
      rawDir: opts.rawDir, rgba: opts.rgba, sheetW: opts.sheetW, layerId: opts.layerId, clip: opts.clip.state,
      dir: opts.dir, frameNum: f, shift: opts.shift, col: f - 1, row: opts.row, ext: opts.ext,
    });
  }
}

function packLayerSheet({ rawDir, layer, anchors }) {
  const sheetW = SHEET_COLS * CELL;
  const sheetH = SHEET_ROWS * CELL;
  const rgba = new Uint8Array(sheetW * sheetH * 4);
  const trackBounds = layer.id === "body-male" || layer.id === "hair-ponytail";
  const ext = trackBounds ? { minX: CELL, minY: CELL, maxX: -1, maxY: -1 } : null;
  let row = 0;
  for (const clip of CLIPS) {
    for (const dir of DIRS) {
      packClipDir({ rawDir, rgba, sheetW, layerId: layer.id, clip, dir, shift: anchors[dir], row, ext });
      row++;
    }
  }
  packFrameCell({ rawDir, rgba, sheetW, layerId: layer.id, clip: "portrait", dir: "south", frameNum: 1, shift: anchors.south, col: 0, row: PORTRAIT_ROW, ext });
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

function packBowOverlaySheet({ rawDir, anchors }) {
  if (!anchors || !fs.existsSync(path.join(rawDir, "weapon-bow", "bow_south_f1.png"))) return null;
  const cols = 3;
  const rows = DIRS.length;
  const sheetW = cols * CELL;
  const sheetH = rows * CELL;
  const rgba = new Uint8Array(sheetW * sheetH * 4);
  for (let dIdx = 0; dIdx < DIRS.length; dIdx++) {
    const dir = DIRS[dIdx];
    const shift = anchors[dir];
    for (let f = 1; f <= cols; f++) {
      const cleaned = loadCleanedFrame({ rawDir, layerId: "weapon-bow", clip: "bow", dir, frameNum: f });
      if (!cleaned) continue;
      const outlined = applyOuterSelOut(cleaned, 3.3);
      const aligned = shiftSpriteFrame(outlined, shift.dx, shift.dy);
      blitIntoSheet({ sheetRgba: rgba, sheetW, frame: aligned, col: f - 1, row: dIdx });
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "weapon-bow.png"), encodePng(sheetW, sheetH, rgba));
  return { path: "/assets/player/weapon-bow.png", cols, rows, frameWidth: CELL, frameHeight: CELL };
}

function buildFullRigMeta({ rawDir, anchorsByGender, bowOverlay }) {
  const rawSockets = JSON.parse(fs.readFileSync(path.join(rawDir, "raw_sockets.json"), "utf8"));
  return {
    frameWidth: CELL, frameHeight: CELL, cols: SHEET_COLS, rows: SHEET_ROWS, groundY: GROUND_Y,
    anchorX: 0.5, anchorY: Number((GROUND_Y / CELL).toFixed(4)), scale: Number(WORLD_SCALE.toFixed(4)),
    portraitRow: PORTRAIT_ROW, portraitCol: 0, directions: DIRS,
    clips: Object.fromEntries(CLIPS.map((c, idx) => [c.state, { startRow: idx * 5, frames: c.frames, fps: c.fps }])),
    layers: LAYERS.map((l) => l.id),
    ...(bowOverlay ? { bowOverlay } : {}),
    bakeVersion: Date.now(),
    anchorsByGender,
    sockets: convertSockets(rawSockets, anchorsByGender),
    handSockets: rawSockets.handSockets ? convertSockets(rawSockets.handSockets, anchorsByGender) : undefined,
  };
}

function packTargetLayer({ rawDir, layer, anchors }) {
  if (!anchors) throw new Error(`Missing anchors for ${layer.gender}; export body-${layer.gender} or run full bake.`);
  packLayerSheet({ rawDir, layer, anchors });
}

function runBowOnlyBake({ rawDir, anchorsByGender, prevMeta }) {
  const anchors = anchorsByGender.female ?? anchorsByGender.male;
  const bowOverlay = packBowOverlaySheet({ rawDir, anchors }) ?? prevMeta?.bowOverlay;
  if (!prevMeta) return null;
  const updated = { ...prevMeta, ...(bowOverlay ? { bowOverlay } : {}), bakeVersion: Date.now() };
  fs.writeFileSync(RIG_META_PATH, JSON.stringify(updated, null, 2) + "\n");
  console.log("Baked 3D bow overlay:", { outDir: OUT_DIR, bowOverlay, bakeVersion: updated.bakeVersion });
  return updated;
}

function resolveRigMeta({ rawDir, anchorsByGender, bowOverlay, onlyLayers, prevMeta }) {
  if (onlyLayers && prevMeta) {
    return { ...prevMeta, anchorsByGender, ...(bowOverlay ? { bowOverlay } : {}), bakeVersion: Date.now() };
  }
  return buildFullRigMeta({ rawDir, anchorsByGender, bowOverlay });
}

function resolveBowOverlay({ rawDir, anchorsByGender, prevMeta }) {
  return packBowOverlaySheet({ rawDir, anchors: anchorsByGender.female ?? anchorsByGender.male }) ?? prevMeta?.bowOverlay;
}

function run() {
  const { rawDir, onlyLayers, bowOnly } = parseCliArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const prevMeta = fs.existsSync(RIG_META_PATH) ? JSON.parse(fs.readFileSync(RIG_META_PATH, "utf8")) : null;
  const anchorsByGender = resolveAnchorsByGender(rawDir, prevMeta);
  if (bowOnly && runBowOnlyBake({ rawDir, anchorsByGender, prevMeta })) return;
  const bowOverlay = resolveBowOverlay({ rawDir, anchorsByGender, prevMeta });
  const targets = onlyLayers ? LAYERS.filter((l) => onlyLayers.has(l.id)) : LAYERS;
  for (const layer of targets) packTargetLayer({ rawDir, layer, anchors: anchorsByGender[layer.gender] });
  const rigMeta = resolveRigMeta({ rawDir, anchorsByGender, bowOverlay, onlyLayers, prevMeta });
  fs.writeFileSync(RIG_META_PATH, JSON.stringify(rigMeta, null, 2) + "\n");
  console.log("Baked player assets:", { outDir: OUT_DIR, bakedLayers: targets.length, bakeVersion: rigMeta.bakeVersion });
}

run();
