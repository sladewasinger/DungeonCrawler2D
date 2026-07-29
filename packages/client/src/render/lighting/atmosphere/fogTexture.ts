import type Phaser from "phaser";
import { lightingColor, LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const FOG = LIGHTING_VISUAL_STYLE.fog;

/** Builds one repeatable translucent cloud tile and reuses it across world bindings. */
export function ensureFogTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(FOG.textureKey)) return FOG.textureKey;
  const graphics = scene.add.graphics();
  const size = FOG.textureSizePx;
  graphics.fillStyle(lightingColor(FOG.color), 0.12);
  for (let index = 0; index < 14; index += 1) {
    const x = fogCoordinate(index, 37, size);
    const y = fogCoordinate(index, 61, size);
    const radius = 18 + (index % 4) * 11;
    graphics.fillCircle(x, y, radius);
  }
  graphics.generateTexture(FOG.textureKey, size, size);
  graphics.destroy();
  return FOG.textureKey;
}

function fogCoordinate(index: number, salt: number, size: number): number {
  return ((index * salt + salt * 0.37) % size + size) % size;
}
