/** Pooled directional cast-shadow sprites synced with Day/Night solar angles. */
import type { ChunkProp, DayNightState } from "@dc2d/engine";
import { PropKind, TILE_PX } from "@dc2d/engine";
import { Container, Sprite, Texture } from "pixi.js";

export interface ShadowCaster {
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly lengthPx: number;
}

export class CastShadowLayer {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private readonly ellipseTex: Texture;

  constructor() {
    this.ellipseTex = createShadowEllipseTexture();
  }

  update(casters: readonly ShadowCaster[], dayNight: DayNightState): void {
    const angle = Math.atan2(dayNight.shadowDy, dayNight.shadowDx);
    const stretch = Math.hypot(dayNight.shadowDx, dayNight.shadowDy);
    let idx = 0;
    for (const c of casters) {
      const s = this.acquire(idx++);
      s.position.set(c.x * TILE_PX + dayNight.shadowDx * (c.lengthPx * 0.35), c.y * TILE_PX + dayNight.shadowDy * (c.lengthPx * 0.22));
      s.width = c.lengthPx * stretch;
      s.height = c.widthPx;
      s.rotation = angle;
      s.alpha = dayNight.shadowAlpha;
      s.visible = true;
    }
    for (let i = idx; i < this.pool.length; i++) {
      const idle = this.pool[i];
      if (idle) idle.visible = false;
    }
  }

  private acquire(index: number): Sprite {
    const existing = this.pool[index];
    if (existing) return existing;
    const sprite = new Sprite(this.ellipseTex);
    sprite.anchor.set(0.5);
    sprite.tint = 0x0a0d18;
    this.pool.push(sprite);
    this.container.addChild(sprite);
    return sprite;
  }
}

export function shadowCasterForProp(prop: ChunkProp): ShadowCaster | null {
  if (prop.kind === PropKind.OakTree) return { x: prop.x, y: prop.y, widthPx: 26, lengthPx: 38 };
  if (prop.kind === PropKind.PineTree) return { x: prop.x, y: prop.y, widthPx: 22, lengthPx: 36 };
  if (prop.kind === PropKind.Boulder) return { x: prop.x, y: prop.y, widthPx: 16, lengthPx: 22 };
  if (prop.kind === PropKind.Bush) return { x: prop.x, y: prop.y, widthPx: 14, lengthPx: 18 };
  if (prop.kind === PropKind.Stump) return { x: prop.x, y: prop.y, widthPx: 10, lengthPx: 14 };
  return null;
}

function createShadowEllipseTexture(): Texture {
  const w = 64;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for shadow texture");
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.scale(1, 0.5);
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.48);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  grad.addColorStop(0.65, "rgba(255, 255, 255, 0.45)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return Texture.from({ resource: canvas, scaleMode: "linear" });
}
