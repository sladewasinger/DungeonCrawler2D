/** Cached soft-dot, smoke puff, and water-ring textures plus additive/tint particle styling. */
import { Sprite, Texture } from "pixi.js";

export type ParticleKind = "mote" | "leaf" | "firefly" | "ember" | "ripple" | "smoke" | "flame";

const PARTICLE_VISUALS: Readonly<Record<ParticleKind, { tint: number; sx: number; sy: number; additive: boolean }>> = {
  mote: { tint: 0xfef08a, sx: 0.25, sy: 0.25, additive: true },
  leaf: { tint: 0x86efac, sx: 0.4, sy: 0.2, additive: false },
  firefly: { tint: 0xd9f99d, sx: 0.35, sy: 0.35, additive: true },
  ember: { tint: 0xfb923c, sx: 0.26, sy: 0.26, additive: true },
  ripple: { tint: 0xbae6fd, sx: 0.5, sy: 0.3, additive: false },
  smoke: { tint: 0xe2e8f0, sx: 0.72, sy: 0.66, additive: false },
  flame: { tint: 0xff9f38, sx: 0.36, sy: 0.54, additive: true },
};

export interface ParticleTextureBank {
  readonly glow: Texture;
  readonly ripple: Texture;
  readonly smoke?: Texture;
}

export function applyParticleStyle(sprite: Sprite, kind: ParticleKind, textures: ParticleTextureBank): void {
  const vis = PARTICLE_VISUALS[kind];
  if (kind === "ripple") sprite.texture = textures.ripple;
  else if (kind === "smoke" && textures.smoke) sprite.texture = textures.smoke;
  else sprite.texture = textures.glow;
  sprite.tint = vis.tint;
  sprite.scale.set(vis.sx, vis.sy);
  sprite.blendMode = vis.additive ? "add" : "normal";
  sprite.visible = true;
}

export function createSoftDotTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d");
  if (!ctx) return Texture.WHITE;
  const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 16);
  return Texture.from(c);
}

export function createSmokePuffTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 24; c.height = 24;
  const ctx = c.getContext("2d");
  if (!ctx) return Texture.WHITE;
  for (const [cx, cy, r] of [[12, 12, 9], [8, 13, 6.5], [16, 13, 6.5], [12, 8, 6]] as const) {
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.6, "rgba(226,232,240,0.42)");
    grad.addColorStop(1, "rgba(203,213,225,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  return Texture.from(c);
}

export function createRingTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 20; c.height = 20;
  const ctx = c.getContext("2d");
  if (!ctx) return Texture.WHITE;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(10, 10, 7.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
  return Texture.from(c);
}
