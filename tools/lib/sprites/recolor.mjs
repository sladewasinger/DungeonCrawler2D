// Generic frame-crop + palette-remap used to build creature recolors from existing sheet frames.
import { Canvas } from '../png-canvas.mjs';

export function extractFrame(sheet, frameByName, name) {
  const rect = frameByName.get(name);
  if (!rect) throw new Error(`recolor: missing source frame "${name}"`);
  return Canvas.fromRegion(sheet, rect.x, rect.y, rect.w, rect.h);
}

/** Replaces every pixel whose hex is a key in `mapping` (Map<hex, rgba>); leaves others untouched. */
export function remapColors(canvas, mapping) {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const [r, g, b, a] = canvas.getPixel(x, y);
      if (a === 0) continue;
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const replacement = mapping.get(hex);
      if (replacement) canvas.setPixel(x, y, replacement);
    }
  }
  return canvas;
}

/** Builds one N-frame recolored series, naming outputs `${outPrefix}_f0..f{n-1}`. */
export function recolorSeries(sheet, frameByName, sourceNames, outPrefix, mapping) {
  return sourceNames.map((sourceName, i) => ({
    name: `${outPrefix}_f${i}`,
    canvas: remapColors(extractFrame(sheet, frameByName, sourceName), mapping),
  }));
}
