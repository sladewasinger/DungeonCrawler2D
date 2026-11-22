/** World-space drifting cloud shadow layer across outdoor forest terrain. */
import type Phaser from "phaser";
import type { ViewRect } from "../../streaming/streaming.js";

const CLOUD_TEXTURE_KEY = "forest-cloud-shadow";
const CLOUD_TEX_W = 128;
const CLOUD_TEX_H = 72;
const CLOUD_DEPTH = 195_000;
const WRAP_PADDING_PX = 380;

interface CloudSpec {
  readonly sprite: Phaser.GameObjects.Image;
  readonly seedX: number;
  readonly seedY: number;
  readonly speedX: number;
  readonly speedY: number;
  readonly baseAlpha: number;
}

const CLOUD_DEFS = [
  { sx: 0, sy: 0, vx: 0.016, vy: 0.006, scale: 3.4, alpha: 0.1 },
  { sx: 420, sy: 210, vx: 0.014, vy: 0.005, scale: 4.1, alpha: 0.11 },
  { sx: 880, sy: 90, vx: 0.018, vy: 0.007, scale: 3.0, alpha: 0.09 },
  { sx: 230, sy: 540, vx: 0.015, vy: 0.006, scale: 4.4, alpha: 0.12 },
  { sx: 710, sy: 420, vx: 0.017, vy: 0.005, scale: 3.6, alpha: 0.1 },
  { sx: 1120, sy: 610, vx: 0.013, vy: 0.007, scale: 3.9, alpha: 0.11 },
] as const;

export class ForestCloudShadows {
  private readonly clouds: CloudSpec[] = [];

  constructor(scene: Phaser.Scene) {
    ensureCloudTexture(scene);
    for (const def of CLOUD_DEFS) {
      const sprite = scene.add
        .image(0, 0, CLOUD_TEXTURE_KEY)
        .setDepth(CLOUD_DEPTH)
        .setScale(def.scale)
        .setAlpha(def.alpha)
        .setVisible(false);
      this.clouds.push({
        sprite, seedX: def.sx, seedY: def.sy, speedX: def.vx, speedY: def.vy, baseAlpha: def.alpha,
      });
    }
  }

  update(view: ViewRect, nowMs: number, visible: boolean): void {
    if (!visible) {
      for (const cloud of this.clouds) cloud.sprite.setVisible(false);
      return;
    }
    const minX = view.x - WRAP_PADDING_PX;
    const minY = view.y - WRAP_PADDING_PX;
    const spanX = Math.max(800, view.width + WRAP_PADDING_PX * 2);
    const spanY = Math.max(600, view.height + WRAP_PADDING_PX * 2);
    for (const cloud of this.clouds) {
      const x = wrapCoord(cloud.seedX + nowMs * cloud.speedX, minX, spanX);
      const y = wrapCoord(cloud.seedY + nowMs * cloud.speedY, minY, spanY);
      cloud.sprite.setPosition(x, y).setAlpha(cloud.baseAlpha).setVisible(true);
    }
  }

  dispose(): void {
    for (const cloud of this.clouds) cloud.sprite.destroy();
    this.clouds.length = 0;
  }
}

function wrapCoord(value: number, min: number, span: number): number {
  const offset = (((value - min) % span) + span) % span;
  return min + offset;
}

function ensureCloudTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLOUD_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(CLOUD_TEXTURE_KEY, CLOUD_TEX_W, CLOUD_TEX_H);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, CLOUD_TEX_W, CLOUD_TEX_H);
  paintCloudLobe(ctx, { cx: CLOUD_TEX_W * 0.5, cy: CLOUD_TEX_H * 0.52, r: 52 });
  paintCloudLobe(ctx, { cx: CLOUD_TEX_W * 0.34, cy: CLOUD_TEX_H * 0.48, r: 36 });
  paintCloudLobe(ctx, { cx: CLOUD_TEX_W * 0.66, cy: CLOUD_TEX_H * 0.48, r: 34 });
  texture.refresh();
}

function paintCloudLobe(
  ctx: CanvasRenderingContext2D,
  input: { readonly cx: number; readonly cy: number; readonly r: number },
): void {
  const { cx, cy, r } = input;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
  grad.addColorStop(0, "rgba(10, 14, 30, 0.85)");
  grad.addColorStop(0.55, "rgba(12, 18, 36, 0.45)");
  grad.addColorStop(1, "rgba(12, 18, 36, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CLOUD_TEX_W, CLOUD_TEX_H);
}
