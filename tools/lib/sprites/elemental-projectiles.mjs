import { Canvas } from '../png-canvas.mjs';
import { opaque, scaleColor } from '../color.mjs';
import { addOutline, fillPolygon } from './shapes.mjs';

function drawOilLob(palette) {
  const canvas = new Canvas(16, 16);
  const oil = scaleColor(palette.CLOTH_DARK, 0.55);
  fillPolygon({
    canvas,
    points: [[4,5],[7,3],[11,4],[13,7],[12,11],[9,13],[5,12],[3,9]],
    hex: oil,
  });
  canvas.fillRect(6, 5, 3, 2, opaque(palette.CLOTH_MID));
  canvas.setPixel(10, 8, opaque(palette.WHITE_HILITE));
  canvas.setPixel(11, 9, opaque(palette.BERRY_RED));
  addOutline(canvas, palette.OUTLINE);
  return canvas;
}

function drawAreaFireFlame(palette) {
  const canvas = new Canvas(16, 16);
  fillPolygon({
    canvas,
    points: [[4,13],[3,10],[5,7],[6,3],[9,6],[11,5],[13,9],[12,13]],
    hex: palette.TORCH_FLAME_MID,
  });
  fillPolygon({
    canvas,
    points: [[6,13],[6,10],[8,7],[10,9],[11,13]],
    hex: palette.TORCH_FLAME_BRIGHT,
  });
  canvas.setPixel(8, 10, opaque(palette.WHITE_HILITE));
  addOutline(canvas, palette.OUTLINE);
  return canvas;
}

export function generateElementalProjectiles(palette) {
  return [
    {
      name: 'projectile_oil_lob',
      canvas: drawOilLob(palette),
    },
    {
      name: 'area_fire_flame',
      canvas: drawAreaFireFlame(palette),
    },
  ];
}
