/** Pooled camera-space drifting sun-motes and falling forest leaves. */
import type Phaser from "phaser";

const MOTE_TEXTURE_KEY = "forest-ambient-mote";
const MOTE_DEPTH = 210_000;
const MOTE_COUNT = 24;

interface MoteParticle {
  readonly sprite: Phaser.GameObjects.Image;
  xNorm: number;
  yNorm: number;
  readonly vxNorm: number;
  readonly vyNorm: number;
  readonly phase: number;
  readonly baseAlpha: number;
}

export interface AmbientMoteUpdate {
  readonly width: number;
  readonly height: number;
  readonly nowMs: number;
  readonly dtSeconds: number;
  readonly visible: boolean;
}

export class ForestAmbientMotes {
  private readonly motes: MoteParticle[] = [];

  constructor(scene: Phaser.Scene) {
    ensureMoteTexture(scene);
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.motes.push(createMote(scene, i));
    }
  }

  update(input: AmbientMoteUpdate): void {
    const { width, height, nowMs, dtSeconds, visible } = input;
    if (!visible || width <= 0 || height <= 0) {
      for (const mote of this.motes) mote.sprite.setVisible(false);
      return;
    }
    const dt = Math.min(0.1, Math.max(0, dtSeconds));
    for (const mote of this.motes) {
      stepMote(mote, { width, height, nowMs, dt });
    }
  }

  dispose(): void {
    for (const mote of this.motes) mote.sprite.destroy();
    this.motes.length = 0;
  }
}

function createMote(scene: Phaser.Scene, index: number): MoteParticle {
  const isLeaf = index % 2 === 1;
  const tint = isLeaf ? (index % 4 === 1 ? 0x86efac : 0xf59e0b) : 0xfef08a;
  const scale = isLeaf ? 1.15 : 0.85;
  const baseAlpha = isLeaf ? 0.42 : 0.34;
  const sprite = scene.add
    .image(0, 0, MOTE_TEXTURE_KEY)
    .setScrollFactor(0)
    .setDepth(MOTE_DEPTH)
    .setTint(tint)
    .setScale(scale)
    .setVisible(false);
  return {
    sprite,
    xNorm: hashNorm(index * 37 + 11),
    yNorm: hashNorm(index * 53 + 23),
    vxNorm: (isLeaf ? 0.018 : 0.008) + hashNorm(index * 19) * 0.014,
    vyNorm: isLeaf ? 0.022 + hashNorm(index * 29) * 0.016 : -0.008 - hashNorm(index * 13) * 0.008,
    phase: index * 1.37,
    baseAlpha,
  };
}

function stepMote(
  mote: MoteParticle,
  ctx: { readonly width: number; readonly height: number; readonly nowMs: number; readonly dt: number },
): void {
  const sway = Math.sin(ctx.nowMs * 0.0016 + mote.phase) * 0.008;
  mote.xNorm = wrapUnit(mote.xNorm + (mote.vxNorm + sway) * ctx.dt);
  mote.yNorm = wrapUnit(mote.yNorm + mote.vyNorm * ctx.dt);
  const pulse = 0.65 + 0.35 * Math.sin(ctx.nowMs * 0.0024 + mote.phase);
  mote.sprite
    .setPosition(mote.xNorm * ctx.width, mote.yNorm * ctx.height)
    .setAlpha(mote.baseAlpha * pulse)
    .setRotation(ctx.nowMs * 0.001 + mote.phase)
    .setVisible(true);
}

function wrapUnit(v: number): number {
  return ((v % 1) + 1) % 1;
}

function hashNorm(seed: number): number {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function ensureMoteTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(MOTE_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(MOTE_TEXTURE_KEY, 6, 6);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 6, 6);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(1, 1, 4, 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillRect(2, 2, 2, 2);
  texture.refresh();
}
