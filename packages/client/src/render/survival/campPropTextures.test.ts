import { describe, expect, it, vi } from "vitest";

interface PixelBounds { minX: number; minY: number; maxX: number; maxY: number; nonEmpty: number; w: number; h: number }

function createMockPixelCanvas(w: number, h: number) {
  const buf = new Uint8ClampedArray(w * h * 4);
  const paintRow = (py: number, x0: number, x1: number): void => {
    for (let px = x0; px < x1; px++) {
      const p = (py * w + px) * 4;
      buf[p] = 180; buf[p + 1] = 120; buf[p + 2] = 80; buf[p + 3] = 255;
    }
  };
  const ctx = {
    fillStyle: "#000000", imageSmoothingEnabled: false,
    fillRect: (...args: readonly [number, number, number, number]) => {
      const [rx, ry, rw, rh] = args;
      const x0 = Math.max(0, Math.floor(rx)); const x1 = Math.min(w, Math.ceil(rx + rw));
      for (let py = Math.max(0, Math.floor(ry)); py < Math.min(h, Math.ceil(ry + (rh || 1))); py++) paintRow(py, x0, x1);
    },
    getImageData: () => ({ data: new Uint8ClampedArray(buf) }),
    putImageData: (img: { readonly data: Uint8ClampedArray }) => { buf.set(img.data); },
  };
  return { canvas: { width: w, height: h, __buf: buf, getContext: () => ctx }, ctx };
}

function measureCanvasBounds(canvas: { readonly width: number; readonly height: number; readonly __buf: Uint8ClampedArray }): PixelBounds {
  const b = { minX: canvas.width, minY: canvas.height, maxX: -1, maxY: -1, nonEmpty: 0, w: canvas.width, h: canvas.height };
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if ((canvas.__buf[(y * canvas.width + x) * 4 + 3] ?? 0) <= 0) continue;
      b.nonEmpty++; b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
      b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
    }
  }
  return b;
}

describe("campPropTextures HD camp and ore sprites", () => {
  it("[REQ-P8-08] generates 48 px/tile textures with non-empty alpha bounds for ores and camp structures", async () => {
    vi.resetModules();
    vi.stubGlobal("document", { createElement: () => createMockPixelCanvas(64, 64).canvas });
    vi.stubGlobal("ImageData", class { constructor(public readonly data: Uint8ClampedArray, public readonly width: number, public readonly height: number) {} });
    vi.doMock("pixi.js", () => ({
      Texture: {
        from: (opts: { readonly resource: { readonly width: number; readonly height: number; readonly __buf: Uint8ClampedArray } }) => ({
          width: opts.resource.width, height: opts.resource.height, bounds: measureCanvasBounds(opts.resource),
        }),
      },
    }));
    try {
      const { createCampPropTextures } = await import("./campPropTextures.js");
      const texSet = createCampPropTextures() as unknown as Record<string, { readonly width: number; readonly height: number; readonly bounds: PixelBounds }>;
      for (const key of ["copperVein", "ironVein", "workbench", "bed", "woodChestClosed", "woodChestOpen", "palisade", "palisadeRailH", "palisadeRailV", "bushStripped"]) {
        const entry = texSet[key]!;
        expect(entry.width, `${key} width`).toBeGreaterThanOrEqual(48);
        expect(entry.height, `${key} height`).toBeGreaterThanOrEqual(48);
        expect(entry.bounds.nonEmpty, `${key} opaque pixels`).toBeGreaterThan(80);
        expect(entry.bounds.maxX).toBeGreaterThan(entry.bounds.minX);
        expect(entry.bounds.maxY).toBeGreaterThan(entry.bounds.minY);
      }
    } finally {
      vi.doUnmock("pixi.js");
      vi.unstubAllGlobals();
    }
  });
});
