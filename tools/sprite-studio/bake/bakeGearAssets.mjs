/** Post-processes 48 px/m 3D gear renders, writes gear/*.png, and syncs sprite-manifest.json. */
import fs from "node:fs";
import path from "node:path";
import { applyInternalDepthCreases, applyOuterSelOut, binarizeAndClean, measureSpriteBounds } from "./pixelPost.mjs";
import { decodePng, encodeLosslessWebp, encodePng } from "./pngCodec.mjs";

const RAW_DIR = process.argv[2];
const REPO_ASSETS = path.resolve(import.meta.dirname, "../../../packages/client/public/assets");
const GEAR_OUT = path.join(REPO_ASSETS, "gear");
const MANIFEST_PATH = path.join(REPO_ASSETS, "sprite-manifest.json");
const REVIEW_OUT = process.argv[3] ?? "";
const SCALE = 0.3333;

const GEAR_SPECS = [
  { id: "gear-sword", file: "sword", anchorX: 0.23, anchorY: 0.5 },
  { id: "gear-flint-dagger", file: "flint-dagger", anchorX: 0.24, anchorY: 0.5 },
  { id: "gear-wooden-spear", file: "wooden-spear", anchorX: 0.34, anchorY: 0.5 },
  { id: "gear-iron-greatsword", file: "iron-greatsword", anchorX: 0.26, anchorY: 0.5 },
  { id: "gear-axe", file: "axe", anchorX: 0.23, anchorY: 0.42 },
  { id: "gear-pickaxe", file: "pickaxe", anchorX: 0.23, anchorY: 0.5 },
  { id: "gear-bow", file: "bow", anchorX: 0.45, anchorY: 0.5 },
  { id: "gear-bow-drawn", file: "bow-drawn", anchorX: 0.56, anchorY: 0.5 },
  { id: "gear-shield", file: "wooden-shield", anchorX: 0.5, anchorY: 0.5 },
  { id: "gear-torch-0", file: "torch-0", anchorX: 0.5, anchorY: 0.72 },
  { id: "gear-torch-1", file: "torch-1", anchorX: 0.5, anchorY: 0.72 },
  { id: "gear-torch-2", file: "torch-2", anchorX: 0.5, anchorY: 0.72 },
  { id: "gear-torch-3", file: "torch-3", anchorX: 0.5, anchorY: 0.72 },
  { id: "gear-lantern-0", file: "lantern-0", anchorX: 0.5, anchorY: 0.5 },
  { id: "gear-lantern-1", file: "lantern-1", anchorX: 0.5, anchorY: 0.5 },
];

function cropTight(img, pad = 1) {
  const b = measureSpriteBounds(img);
  const w = Math.max(4, b.contentWidth + pad * 2);
  const h = Math.max(4, b.contentHeight + pad * 2);
  const out = new Uint8Array(w * h * 4);
  for (let y = b.minY; y <= b.maxY; y++) {
    for (let x = b.minX; x <= b.maxX; x++) {
      const sp = (y * img.width + x) * 4;
      const dp = ((y - b.minY + pad) * w + (x - b.minX + pad)) * 4;
      out[dp] = img.rgba[sp]; out[dp + 1] = img.rgba[sp + 1];
      out[dp + 2] = img.rgba[sp + 2]; out[dp + 3] = img.rgba[sp + 3];
    }
  }
  return { width: w, height: h, rgba: out };
}

function processGearFrame(fileBase) {
  const colorImg = decodePng(fs.readFileSync(path.join(RAW_DIR, `${fileBase}.png`)));
  const depthImg = decodePng(fs.readFileSync(path.join(RAW_DIR, `${fileBase}_depth.png`)));
  const clean = binarizeAndClean(colorImg, 4);
  const creased = applyInternalDepthCreases(clean, depthImg, 14);
  const outlined = applyOuterSelOut(creased, 2.0);
  return cropTight(outlined, 2);
}

function sampleStripBg({ sx, sy, cx, cy }) {
  if (cx === 0 || cy === 0) return [22, 32, 40];
  const checker = (Math.floor(sx / 8) + Math.floor(sy / 8)) & 1;
  return checker === 0 ? [52, 82, 54] : [64, 98, 66];
}

function blendItemIntoPixel({ item, cx, cy, cell, bg }) {
  const ix = cx - Math.floor((cell - item.width) * 0.5);
  const iy = cy - Math.floor((cell - item.height) * 0.5);
  if (ix < 0 || iy < 0 || ix >= item.width || iy >= item.height) return bg;
  const sp = (iy * item.width + ix) * 4;
  const a = item.rgba[sp + 3] / 255;
  return [
    Math.round(bg[0] * (1 - a) + item.rgba[sp] * a),
    Math.round(bg[1] * (1 - a) + item.rgba[sp + 1] * a),
    Math.round(bg[2] * (1 - a) + item.rgba[sp + 2] * a),
  ];
}

function writeReviewStrip(items, outPath) {
  if (!outPath) return;
  const cell = 64;
  const zoom = 3;
  const rw = items.length * cell * zoom;
  const rh = cell * zoom;
  const out = new Uint8Array(rw * rh * 4);
  for (let py = 0; py < rh; py++) {
    const sy = Math.floor(py / zoom);
    for (let px = 0; px < rw; px++) {
      const sx = Math.floor(px / zoom);
      const col = Math.floor(sx / cell);
      const cx = sx % cell;
      const bg = sampleStripBg({ sx, sy, cx, cy: sy });
      const rgb = blendItemIntoPixel({ item: items[col], cx, cy: sy, cell, bg });
      const dp = (py * rw + px) * 4;
      out[dp] = rgb[0]; out[dp + 1] = rgb[1]; out[dp + 2] = rgb[2]; out[dp + 3] = 255;
    }
  }
  fs.writeFileSync(outPath, encodePng(rw, rh, out));
}

function run() {
  if (!RAW_DIR) throw new Error("Usage: node bakeGearAssets.mjs <rawDir> [reviewPng]");
  fs.mkdirSync(GEAR_OUT, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const rendered = [];
  for (const spec of GEAR_SPECS) {
    const img = processGearFrame(spec.file);
    fs.writeFileSync(path.join(GEAR_OUT, `${spec.file}.webp`), encodeLosslessWebp(img.width, img.height, img.rgba));
    manifest.assets[spec.id] = {
      path: `/assets/gear/${spec.file}.webp`,
      width: img.width,
      height: img.height,
      contentWidth: img.width - 4,
      contentHeight: img.height - 4,
      scale: SCALE,
      anchorX: spec.anchorX,
      anchorY: spec.anchorY,
    };
    rendered.push(img);
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  writeReviewStrip(rendered, REVIEW_OUT);
  console.log(`Baked ${GEAR_SPECS.length} 3D gear assets into ${GEAR_OUT}`);
}

run();
