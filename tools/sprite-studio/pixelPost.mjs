/** Pure Cainos-style pixel art post-processor: alpha cleanup, depth creases, sel-out outlines, and grounding. */

function computeSelOutRgb(r, g, b) {
  return [
    Math.max(10, Math.round(r * 0.22 + 5)),
    Math.max(9, Math.round(g * 0.20 + 3)),
    Math.max(15, Math.round(b * 0.26 + 9)),
  ];
}

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function cardinals(idx, width, height) {
  const x = idx % width;
  const y = (idx - x) / width;
  const out = [];
  if (x > 0) out.push(idx - 1);
  if (x + 1 < width) out.push(idx + 1);
  if (y > 0) out.push(idx - width);
  if (y + 1 < height) out.push(idx + width);
  return out;
}

function collectComponent(opts) {
  const { start, width, height, rgba, visited, queue } = opts;
  let head = 0;
  let tail = 0;
  visited[start] = 1;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    for (const ni of cardinals(cur, width, height)) {
      if (!visited[ni] && rgba[ni * 4 + 3] > 0) {
        visited[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }
  return tail;
}

function clearComponentPixels(rgba, queue, size) {
  for (let k = 0; k < size; k++) {
    const p = queue[k] * 4;
    rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0;
  }
}

function thresholdAlpha(rgba, n) {
  for (let i = 0; i < n; i++) {
    rgba[i * 4 + 3] = rgba[i * 4 + 3] >= 128 ? 255 : 0;
  }
}

export function binarizeAndClean(img, minIslandArea = 4) {
  const { width, height } = img;
  const n = width * height;
  const rgba = new Uint8Array(img.rgba);
  thresholdAlpha(rgba, n);
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (visited[i] || rgba[i * 4 + 3] === 0) continue;
    const size = collectComponent({ start: i, width, height, rgba, visited, queue });
    if (size < minIslandArea) clearComponentPixels(rgba, queue, size);
  }
  return { width, height, rgba };
}

function darkenIntoCrease(rgba, dstIdx) {
  const p = dstIdx * 4;
  const [sr, sg, sb] = computeSelOutRgb(rgba[p], rgba[p + 1], rgba[p + 2]);
  rgba[p] = Math.round(rgba[p] * 0.56 + sr * 0.44);
  rgba[p + 1] = Math.round(rgba[p + 1] * 0.56 + sg * 0.44);
  rgba[p + 2] = Math.round(rgba[p + 2] * 0.56 + sb * 0.44);
}

function creaseNeighborsForPixel(opts) {
  const { out, img, depthImg, i, threshold } = opts;
  const dSelf = depthImg.rgba[i * 4];
  for (const ni of cardinals(i, img.width, img.height)) {
    const opaqueNeighbor = img.rgba[ni * 4 + 3] > 0;
    if (opaqueNeighbor && depthImg.rgba[ni * 4] - dSelf >= threshold) darkenIntoCrease(out, ni);
  }
}

export function applyInternalDepthCreases(img, depthImg, threshold = 16) {
  const { width, height } = img;
  const out = new Uint8Array(img.rgba);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    if (img.rgba[i * 4 + 3] > 0) creaseNeighborsForPixel({ out, img, depthImg, i, threshold });
  }
  return { width, height, rgba: out };
}

const DISK_OFFSET_CACHE = new Map();

function pushDiskRow({ out, dy, key, maxR }) {
  for (let dx = -key; dx <= key; dx++) {
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist <= maxR) out.push([dx, dy, dist]);
  }
}

function getDiskOffsets(maxRadius = 3.0) {
  const key = Math.ceil(maxRadius);
  const cacheKey = Math.round(maxRadius * 100);
  const cached = DISK_OFFSET_CACHE.get(cacheKey);
  if (cached) return cached;
  const out = [];
  for (let dy = -key; dy <= key; dy++) pushDiskRow({ out, dy, key, maxR: maxRadius });
  out.sort((a, b) => a[2] - b[2]);
  DISK_OFFSET_CACHE.set(cacheKey, out);
  return out;
}

function findNearestOpaqueNeighbor(img, idx, maxRadius) {
  const { width, height, rgba } = img;
  const x = idx % width;
  const y = (idx - x) / width;
  for (const [dx, dy, dist] of getDiskOffsets(maxRadius)) {
    const nx = x + dx; const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const p = (ny * width + nx) * 4;
    if (rgba[p + 3] > 0) return { rgb: [rgba[p], rgba[p + 1], rgba[p + 2]], dist };
  }
  return null;
}

export function applyOuterSelOut(img, radiusPx = 2.0) {
  const { width, height } = img;
  const out = new Uint8Array(img.rgba);
  const solidR = Math.max(0.75, radiusPx);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    if (img.rgba[i * 4 + 3] > 0) continue;
    const hit = findNearestOpaqueNeighbor(img, i, solidR);
    if (!hit) continue;
    const [r, g, b] = computeSelOutRgb(hit.rgb[0], hit.rgb[1], hit.rgb[2]);
    const p = i * 4;
    out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = 255;
  }
  return { width, height, rgba: out };
}

export function measureSpriteBounds(img) {
  const { width, height, rgba } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const len = width * height;
  for (let i = 0; i < len; i++) {
    if (rgba[i * 4 + 3] === 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return {
    minX, minY, maxX, maxY,
    contentWidth: maxX >= minX ? maxX - minX + 1 : 0,
    contentHeight: maxY >= minY ? maxY - minY + 1 : 0,
  };
}

function copyShiftedRow(opts) {
  const { src, out, width, y, sy, dx } = opts;
  for (let x = 0; x < width; x++) {
    const sx = x - dx;
    if (sx < 0 || sx >= width) continue;
    const sp = (sy * width + sx) * 4;
    const dp = (y * width + x) * 4;
    out[dp] = src[sp]; out[dp + 1] = src[sp + 1]; out[dp + 2] = src[sp + 2]; out[dp + 3] = src[sp + 3];
  }
}

export function shiftSpriteFrame(img, dx, dy) {
  const { width, height, rgba } = img;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = y - dy;
    if (sy >= 0 && sy < height) copyShiftedRow({ src: rgba, out, width, y, sy, dx });
  }
  return { width, height, rgba: out };
}

function resolveTranslucentPixelAlpha(opts) {
  const { r, g, b, isInterior, bodyAlpha } = opts;
  if (!isInterior) return Math.round(255 * Math.min(1, bodyAlpha + 0.14));
  const isWarmEye = r > g + 12;
  const isDarkPupil = Math.max(r, g, b) < 38;
  const isBrightSheen = luma(r, g, b) > 215;
  if (isWarmEye || isDarkPupil || isBrightSheen) return 245;
  return Math.round(255 * bodyAlpha);
}

export function applyTranslucentBodyAlpha(outlined, interiorMask, bodyAlpha = 1.0) {
  if (bodyAlpha >= 0.999) return outlined;
  const { width, height } = outlined;
  const out = new Uint8Array(outlined.rgba);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (out[p + 3] === 0) continue;
    out[p + 3] = resolveTranslucentPixelAlpha({
      r: out[p], g: out[p + 1], b: out[p + 2],
      isInterior: interiorMask[i] > 0, bodyAlpha,
    });
  }
  return { width, height, rgba: out };
}

function captureOpaqueMask(img) {
  const n = img.width * img.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = img.rgba[i * 4 + 3] > 0 ? 1 : 0;
  return mask;
}

export function postProcessFrame(opts) {
  const clean = binarizeAndClean(opts.colorImg, opts.minIslandArea ?? 4);
  const creased = opts.depthImg ? applyInternalDepthCreases(clean, opts.depthImg) : clean;
  const interiorMask = captureOpaqueMask(creased);
  const outlined = applyOuterSelOut(creased, opts.outlineRadius ?? 4);
  const translucent = applyTranslucentBodyAlpha(outlined, interiorMask, opts.bodyAlpha ?? 1.0);
  const bounds = measureSpriteBounds(translucent);
  const dx = opts.dx ?? (Math.floor(translucent.width / 2) - Math.round((bounds.minX + bounds.maxX) * 0.5));
  const dy = opts.dy ?? (opts.groundY - bounds.maxY);
  return { frame: shiftSpriteFrame(translucent, dx, dy), bounds, dx, dy };
}
