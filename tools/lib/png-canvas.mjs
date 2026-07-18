// Minimal RGBA pixel-buffer wrapper over pngjs so every generator draws through one small API.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

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

  static fromRegion(source, x, y, w, h) {
    const canvas = new Canvas(w, h);
    canvas.blit(source, x, y, 0, 0, w, h);
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

  fillRect(x, y, w, h, rgba) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setPixel(xx, yy, rgba);
  }

  /**
   * Alpha-composites a `sw`x`sh` region from `src` at (sx,sy) onto this canvas at (dx,dy)
   * using "source over destination". Fully transparent source pixels are skipped so they
   * never punch a hole in whatever is already drawn underneath (e.g. a panel background);
   * fully opaque source pixels take a fast exact-copy path.
   */
  blit(src, sx, sy, dx, dy, sw, sh) {
    for (let yy = 0; yy < sh; yy++) {
      for (let xx = 0; xx < sw; xx++) {
        const [sr, sg, sb, sa] = src.getPixel(sx + xx, sy + yy);
        if (sa === 0) continue;
        if (sa === 255) {
          this.setPixel(dx + xx, dy + yy, [sr, sg, sb, sa]);
          continue;
        }
        const [dr, dg, db, da] = this.getPixel(dx + xx, dy + yy);
        const srcA = sa / 255;
        const dstA = (da / 255) * (1 - srcA);
        const outA = srcA + dstA;
        const mix = (s, d) => (outA === 0 ? 0 : (s * srcA + d * dstA) / outA);
        this.setPixel(dx + xx, dy + yy, [mix(sr, dr), mix(sg, dg), mix(sb, db), Math.round(outA * 255)]);
      }
    }
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
