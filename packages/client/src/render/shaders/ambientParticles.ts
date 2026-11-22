/** Pooled GPU ambient particles: sun-motes, leaves, fireflies, embers, and ripples. */
import { TILE_PX, hashUnit2d, type DayNightState, type PointLightSpec } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import {
  applyParticleStyle,
  createRingTexture,
  createSoftDotTexture,
  type ParticleKind,
} from "./particleTextures.js";

interface ParticleSlot {
  readonly sprite: Sprite;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  phase: number;
  active: boolean;
}

export interface ParticleStepInput {
  readonly dt: number;
  readonly timeSec: number;
  readonly dayNight: DayNightState;
  readonly center: { readonly x: number; readonly y: number };
  readonly maxParticles: number;
  readonly campfires: readonly PointLightSpec[];
  readonly playerWading: boolean;
}

export class AmbientParticleLayer {
  readonly container = new Container();
  private readonly slots: ParticleSlot[] = [];
  private readonly textures: { readonly glow: Texture; readonly ripple: Texture };
  private seedCounter = 1;
  private rippleTimer = 0;

  constructor() {
    this.textures = { glow: createSoftDotTexture(), ripple: createRingTexture() };
  }

  step(input: ParticleStepInput): void {
    let activeCount = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      this.stepSlot(slot, input);
      if (slot.active) activeCount += 1;
    }
    this.rippleTimer = Math.max(0, this.rippleTimer - input.dt);
    let budget = input.maxParticles - activeCount;
    if (budget <= 0) return;
    budget -= this.maybeSpawnRipple(input);
    if (budget > 0) budget -= this.maybeSpawnEmber(input);
    this.spawnAmbientFloaters(input, Math.min(2, budget));
  }

  private maybeSpawnRipple(input: ParticleStepInput): number {
    if (!input.playerWading || this.rippleTimer > 0) return 0;
    this.spawnAt("ripple", { x: input.center.x, y: input.center.y, vx: 0, vy: 0, life: 0.65 });
    this.rippleTimer = 0.24;
    return 1;
  }

  private maybeSpawnEmber(input: ParticleStepInput): number {
    if (input.campfires.length === 0 || this.rand() >= 0.35) return 0;
    const fire = input.campfires[Math.floor(this.rand() * input.campfires.length)];
    if (!fire) return 0;
    this.spawnAt("ember", {
      x: fire.x + (this.rand() - 0.5) * 0.4,
      y: fire.y - 0.2,
      vx: (this.rand() - 0.5) * 0.4,
      vy: -1.1 - this.rand() * 0.6,
      life: 1.3,
    });
    return 1;
  }

  private spawnAmbientFloaters(input: ParticleStepInput, count: number): void {
    const isNight = input.dayNight.fireflyStrength > 0.22;
    for (let i = 0; i < count; i++) this.spawnSingleFloater(input, isNight);
  }

  private spawnSingleFloater(input: ParticleStepInput, isNight: boolean): void {
    const kind: ParticleKind = isNight ? "firefly" : this.rand() < 0.35 ? "leaf" : "mote";
    const vxBase = isNight ? 0.55 : 0.7;
    const vy = isNight ? (this.rand() - 0.5) * 0.45 : 0.35 + this.rand() * 0.35;
    this.spawnAt(kind, {
      x: input.center.x + (this.rand() - 0.5) * 26,
      y: input.center.y + (this.rand() - 0.5) * 18,
      vx: (this.rand() - 0.5) * vxBase,
      vy,
      life: 3.8 + this.rand() * 2.5,
    });
  }

  private spawnAt(
    kind: ParticleKind,
    cfg: { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly life: number },
  ): void {
    const slot = this.acquireSlot();
    slot.kind = kind;
    slot.x = cfg.x;
    slot.y = cfg.y;
    slot.vx = cfg.vx;
    slot.vy = cfg.vy;
    slot.life = 0;
    slot.maxLife = cfg.life;
    slot.phase = this.rand() * 6.28;
    slot.active = true;
    applyParticleStyle(slot.sprite, kind, this.textures);
  }

  private stepSlot(slot: ParticleSlot, input: ParticleStepInput): void {
    slot.life += input.dt;
    if (slot.life >= slot.maxLife) { slot.active = false; slot.sprite.visible = false; return; }
    const progress = slot.life / slot.maxLife;
    const sway = slot.kind === "leaf" || slot.kind === "firefly" ? Math.sin(input.timeSec * 3.1 + slot.phase) * 0.35 : 0;
    slot.x += (slot.vx + sway) * input.dt;
    slot.y += slot.vy * input.dt;
    slot.sprite.position.set(slot.x * TILE_PX, slot.y * TILE_PX);
    if (slot.kind === "ripple") {
      const s = 0.4 + progress * 1.4;
      slot.sprite.scale.set(s, s * 0.65);
      slot.sprite.alpha = (1 - progress) * 0.65;
      return;
    }
    const pulse = slot.kind === "firefly" ? 0.55 + 0.45 * Math.sin(input.timeSec * 6 + slot.phase) : 1;
    const baseAlpha = slot.kind === "firefly" ? Math.max(0.25, input.dayNight.fireflyStrength) : 0.78;
    slot.sprite.alpha = Math.sin(progress * Math.PI) * pulse * baseAlpha;
  }

  private acquireSlot(): ParticleSlot {
    const free = this.slots.find((s) => !s.active);
    if (free) return free;
    const sprite = new Sprite(this.textures.glow);
    sprite.anchor.set(0.5);
    const slot: ParticleSlot = { sprite, kind: "mote", x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, phase: 0, active: false };
    this.slots.push(slot);
    this.container.addChild(sprite);
    return slot;
  }

  private rand(): number {
    return hashUnit2d(409, this.seedCounter++, 17);
  }
}
