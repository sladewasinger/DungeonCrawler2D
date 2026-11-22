/** Procedural textures and visual style mapping for ambient GPU particles. */
import { Sprite, Texture } from "pixi.js";

export type ParticleKind = "mote" | "leaf" | "firefly" | "ember" | "ripple";

const PARTICLE_VISUALS: Readonly<Record<ParticleKind, { tint: number; sx: number; sy: number; additive: boolean }>> = {
  firefly: { tint: 0xd9f99d, sx: 0.55, sy: 0.55, additive: true },
  ember: { tint: 0xfb923c, sx: 0.4, sy: 0.4, additive: true },
  leaf: { tint: 0x86efac, sx: 0.32, sy: 0.2, additive: false },
  ripple: { tint: 0xbae6fd, sx: 0.5, sy: 0.5, additive: false },
  mote: { tint: 0xfef9c3, sx: 0.28, sy: 0.28, additive: false },
};

export function applyParticleStyle(
  sprite: Sprite,
  kind: ParticleKind,
  textures: { readonly glow: Texture; readonly ripple: Texture },
): void {
  const style = PARTICLE_VISUALS[kind];
  sprite.texture = kind === "ripple" ? textures.ripple : textures.glow;
  sprite.blendMode = style.additive ? "add" : "normal";
  sprite.tint = style.tint;
  sprite.scale.set(style.sx, style.sy);
  sprite.visible = true;
}

export function createSoftDotTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for particle");
  const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 16);
  return Texture.from({ resource: canvas, scaleMode: "linear" });
}

export function createRingTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for ripple");
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(12, 12, 9, 0, Math.PI * 2);
  ctx.stroke();
  return Texture.from({ resource: canvas, scaleMode: "linear" });
}
