import type Phaser from "phaser";

const RING_COUNT = 16;
const BRUSH_PREFIX = "lighting-darkness-reveal";

/** Reuses a soft radial alpha texture for erasing small LOS-visible mask cells. */
export function ensureDarknessRevealBrush(
  scene: Phaser.Scene,
  radiusPx: number,
  alpha = 1,
): string {
  const radius = Math.max(2, Math.ceil(radiusPx));
  const boundedAlpha = Math.max(0, Math.min(1, alpha));
  const alphaStep = Math.round(boundedAlpha * 15);
  const key = `${BRUSH_PREFIX}-${radius}-${alphaStep}`;
  if (scene.textures.exists(key)) return key;
  const graphics = scene.add.graphics();
  const diameter = radius * 2 + 2;
  const center = diameter / 2;
  const quantizedAlpha = alphaStep / 15;
  for (let index = 0; index < RING_COUNT; index += 1) {
    const progress = index / (RING_COUNT - 1);
    const ringRadius = radius * (1 - progress * 0.92);
    const ringAlpha = (0.035 + progress * 0.115) * quantizedAlpha;
    graphics.fillStyle(0xffffff, ringAlpha);
    graphics.fillCircle(center, center, ringRadius);
  }
  graphics.generateTexture(key, diameter, diameter);
  graphics.destroy();
  return key;
}
