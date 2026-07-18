// Thin RGBA pixel buffer over pngjs — fill/rect helpers and PNG file output.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { Rgb } from "./colors.js";

export class Canvas {
  private readonly png: PNG;

  constructor(
    readonly width: number,
    readonly height: number,
    background: Rgb,
  ) {
    this.png = new PNG({ width, height });
    this.fillRect(0, 0, width, height, background);
  }

  private setPixel(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (this.width * y + x) << 2;
    this.png.data[i] = c.r;
    this.png.data[i + 1] = c.g;
    this.png.data[i + 2] = c.b;
    this.png.data[i + 3] = 255;
  }

  fillRect(x0: number, y0: number, w: number, h: number, c: Rgb): void {
    const xEnd = Math.min(this.width, x0 + w);
    const yEnd = Math.min(this.height, y0 + h);
    for (let y = Math.max(0, y0); y < yEnd; y++) {
      for (let x = Math.max(0, x0); x < xEnd; x++) {
        this.setPixel(x, y, c);
      }
    }
  }

  write(outPath: string): void {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, PNG.sync.write(this.png));
  }
}
