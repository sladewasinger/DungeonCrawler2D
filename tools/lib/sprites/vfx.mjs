// The two declared non-16px exceptions: soft light/particle textures for the lighting layer.
// Unlike the pixel-art icons elsewhere, these use a smooth alpha falloff on purpose.
import { Canvas } from '../png-canvas.mjs';

function drawRadialSoft(size) {
  const c = new Canvas(size, size);
  const center = (size - 1) / 2;
  const maxRadius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - center, y - center);
      const t = Math.min(1, dist / maxRadius);
      const falloff = Math.pow(1 - t, 2);
      c.setPixel(x, y, [255, 255, 255, Math.round(255 * falloff)]);
    }
  }
  return c;
}

export function generateVfx() {
  return [
    { name: 'light_soft', canvas: drawRadialSoft(64) },
    { name: 'particle_soft', canvas: drawRadialSoft(8) },
  ];
}
