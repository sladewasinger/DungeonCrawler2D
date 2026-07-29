// Minimal RGBA pixel-buffer wrapper over pngjs so every generator draws through one small API.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

function readRect(first, rest) {
  if (typeof first === 'object') return { rect: first, remainder: rest };
  const [y, w, h, ...remainder] = rest;
  return { rect: { x: first, y, w, h }, remainder };
}

function readFillArgs(first, rest) {
  const { rect, remainder } = readRect(first, rest);
  return { rect, rgba: remainder[0] };
}

function readBlitArgs(sourceRectOrX, rest) {
  if (typeof sourceRectOrX === 'object') {
    return { sourceRect: sourceRectOrX, destRect: rest[0] };
  }
  const [sy, dx, dy, sw, sh] = rest;
  return {
    sourceRect: { x: sourceRectOrX, y: sy, w: sw, h: sh },
    destRect: { x: dx, y: dy, w: sw, h: sh },
  };
}

export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  static fromFile(path) {
    const png = PNG.sync.read(readFileSync(path));
    const canvas = new Canvas(png.width, png.height);
    canvas.data.set(png.data);
    return canvas;
  }

  static fromRegion(source, rectOrX, ...args) {
    const { rect } = readRect(rectOrX, args);
    const canvas = new Canvas(rect.w, rect.h);
    canvas.blit(source, rect, { x: 0, y: 0, w: rect.w, h: rect.h });
    return canvas;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  setPixel(x, y, [r, g, b, a]) {
    if (!this.inBounds(x, y)) return;
    const i = (this.width * y + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  getPixel(x, y) {
    if (!this.inBounds(x, y)) return [0, 0, 0, 0];
    const i = (this.width * y + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  fillRect(rectOrX, ...args) {
    const { rect, rgba } = readFillArgs(rectOrX, args);
    for (let yy = rect.y; yy < rect.y + rect.h; yy++) {
      for (let xx = rect.x; xx < rect.x + rect.w; xx++) this.setPixel(xx, yy, rgba);
    }
  }

  /**
   * Alpha-composites a `sw`x`sh` region from `src` at (sx,sy) onto this canvas at (dx,dy)
   * using "source over destination". Fully transparent source pixels are skipped so they
   * never punch a hole in whatever is already drawn underneath (e.g. a panel background);
   * fully opaque source pixels take a fast exact-copy path.
   */
  blit(src, sourceRectOrX, ...args) {
    const { sourceRect, destRect } = readBlitArgs(sourceRectOrX, args);
    for (let yy = 0; yy < sourceRect.h; yy++) {
      for (let xx = 0; xx < sourceRect.w; xx++) {
        this.copyPixel(src, { sourceRect, destRect, xx, yy });
      }
    }
  }

  copyPixel(src, { sourceRect, destRect, xx, yy }) {
    const [sr, sg, sb, sa] = src.getPixel(sourceRect.x + xx, sourceRect.y + yy);
    if (sa === 0) return;
    if (sa === 255) {
      this.setPixel(destRect.x + xx, destRect.y + yy, [sr, sg, sb, sa]);
      return;
    }
    const [dr, dg, db, da] = this.getPixel(destRect.x + xx, destRect.y + yy);
    const srcA = sa / 255;
    const dstA = (da / 255) * (1 - srcA);
    const outA = srcA + dstA;
    const mix = (source, destination) =>
      outA === 0 ? 0 : (source * srcA + destination * dstA) / outA;
    this.setPixel(destRect.x + xx, destRect.y + yy, [
      mix(sr, dr), mix(sg, dg), mix(sb, db), Math.round(outA * 255),
    ]);
  }

  toPngBuffer() {
    const png = new PNG({ width: this.width, height: this.height });
    png.data.set(this.data);
    return PNG.sync.write(png);
  }

  writeFile(path) {
    writeFileSync(path, this.toPngBuffer());
  }
}
