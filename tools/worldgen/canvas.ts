// Thin RGBA pixel buffer over pngjs — fill/rect helpers and PNG file output.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { Rgb } from "./colors.js";

function rectArgs(first: number | { x: number; y: number; w: number; h: number }, rest: unknown[]): {
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly color: Rgb;
} {
  if (typeof first !== "number") return { rect: first, color: rest[0] as Rgb };
  const [y, w, h, color] = rest as [number, number, number, Rgb];
  return { rect: { x: first, y, w, h }, color };
}

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

  fillRect(
    rectOrX: number | { x: number; y: number; w: number; h: number },
    ...args: unknown[]
  ): void {
    const { rect, color } = rectArgs(rectOrX, args);
    const xEnd = Math.min(this.width, rect.x + rect.w);
    const yEnd = Math.min(this.height, rect.y + rect.h);
    for (let y = Math.max(0, rect.y); y < yEnd; y++) {
      for (let x = Math.max(0, rect.x); x < xEnd; x++) {
        this.setPixel(x, y, color);
      }
    }
  }

  write(outPath: string): void {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, PNG.sync.write(this.png));
  }
}
