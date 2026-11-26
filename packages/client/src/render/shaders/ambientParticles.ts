/** Pooled GPU ambient & FX particles: sun-motes, leaves, fireflies, torch flames, embers, ripples & smoke poofs. */
import { TILE_PX, hashUnit2d, type BiomeKind, type DayNightState, type PointLightSpec } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import {
  applyParticleStyle, createRingTexture, createSmokePuffTexture, createSoftDotTexture, type ParticleKind,
} from "./particleTextures.js";

interface ParticleSlot {
  readonly sprite: Sprite; kind: ParticleKind;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; phase: number; active: boolean;
}

export interface WaterRippleActor {
  readonly x: number; readonly y: number; readonly moving: boolean; readonly deep: boolean;
}

const BIOME_FLOATER_FN: Partial<Record<BiomeKind, (r: number) => ParticleKind>> = {
  "misty-bog": (r) => (r < 0.75 ? "spore" : "firefly"),
  "craggy-highlands": (r) => (r < 0.65 ? "ember" : "mote"),
  "cursed-ruinlands": () => "wisp",
  "autumn-woods": () => "autumnLeaf",
};

export interface ParticleStepInput {
  readonly dt: number; readonly timeSec: number; readonly dayNight: DayNightState;
  readonly center: { readonly x: number; readonly y: number };
  readonly biome?: BiomeKind;
  readonly maxParticles: number;
  readonly campfires: readonly PointLightSpec[];
  readonly torches?: readonly PointLightSpec[];
  readonly playerWading?: boolean;
  readonly waterActors?: readonly WaterRippleActor[];
  readonly burningActors?: readonly { readonly x: number; readonly y: number }[];
  readonly coverActors?: readonly { readonly x: number; readonly y: number }[];
}

export class AmbientParticleLayer {
  readonly container = new Container();
  private readonly slots: ParticleSlot[] = [];
  private readonly textures: { readonly glow: Texture; readonly ripple: Texture; readonly smoke: Texture };
  private seedCounter = 1;
  private rippleTimer = 0;

  constructor() {
    this.textures = { glow: createSoftDotTexture(), ripple: createRingTexture(), smoke: createSmokePuffTexture() };
  }

  spawnSmokePoof(opts: { readonly x: number; readonly y: number; readonly durationSec?: number | undefined }): void {
    const baseDur = Math.max(0.8, opts.durationSec ?? 4.0);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + (this.rand() - 0.5) * 0.4;
      const radial = 0.45 + this.rand() * 0.95;
      this.spawnAt("smoke", {
        x: opts.x + (this.rand() - 0.5) * 0.45,
        y: opts.y - 0.35 + (this.rand() - 0.5) * 0.35,
        vx: Math.cos(ang) * radial,
        vy: Math.sin(ang) * radial * 0.55 - (0.18 + this.rand() * 0.25),
        life: baseDur * (0.76 + this.rand() * 0.28),
      });
    }
  }

  step(input: ParticleStepInput): void {
    let activeCount = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      this.stepSlot(slot, input);
      if (slot.active) activeCount += 1;
    }
    this.rippleTimer = Math.max(0, this.rippleTimer - input.dt);
    const budget = input.maxParticles - activeCount;
    if (budget > 0) this.runSpawners(input, budget);
  }

  private runSpawners(input: ParticleStepInput, budget: number): void {
    let rem = budget - this.maybeSpawnRipples(input);
    if (rem > 0) rem -= this.maybeSpawnFireParticles(input);
    if (rem > 0) rem -= this.spawnBurnAndCoverFx(input);
    this.spawnAmbientFloaters(input, Math.min(2, rem));
  }

  private spawnBurnAndCoverFx(input: ParticleStepInput): number {
    let used = 0;
    for (const b of input.burningActors ?? []) {
      if (this.rand() < 0.65) { this.emitTorchFlame(b.x, b.y - 0.55); used += 1; }
    }
    for (const c of input.coverActors ?? []) {
      if (this.rand() < 0.28) { this.emitCoverLeaf(c.x, c.y); used += 1; }
    }
    return used;
  }

  private emitCoverLeaf(x: number, y: number): void {
    this.spawnAt("leaf", {
      x: x + (this.rand() - 0.5) * 0.45, y: y - 0.3,
      vx: (this.rand() - 0.5) * 0.85, vy: 0.25 + this.rand() * 0.45, life: 0.9 + this.rand() * 0.4,
    });
  }

  private maybeSpawnRipples(input: ParticleStepInput): number {
    if (this.rippleTimer > 0) return 0;
    const actors = (input.waterActors ?? []).filter((a) => a.moving || a.deep);
    if (actors.length === 0) return this.tryFallbackRipple(input);
    for (const a of actors) this.spawnAt("ripple", { x: a.x, y: a.y, vx: 0, vy: 0, life: a.deep ? 0.72 : 0.6 });
    this.rippleTimer = 0.26;
    return actors.length;
  }

  private tryFallbackRipple(input: ParticleStepInput): number {
    if (!input.playerWading) return 0;
    this.spawnAt("ripple", { x: input.center.x, y: input.center.y, vx: 0, vy: 0, life: 0.65 });
    this.rippleTimer = 0.24;
    return 1;
  }

  private pickRandomLight(list: readonly PointLightSpec[] | undefined, prob: number): PointLightSpec | null {
    if (!list?.length || this.rand() >= prob) return null;
    return list[Math.floor(this.rand() * list.length)] ?? null;
  }

  private maybeSpawnFireParticles(input: ParticleStepInput): number {
    let used = 0;
    const fire = this.pickRandomLight(input.campfires, 0.38);
    if (fire) { this.emitEmberAt(fire.x, fire.y - 0.2); used += 1; }
    const torch = this.pickRandomLight(input.torches, 0.65);
    if (torch) { this.emitTorchFlame(torch.x, torch.y - 0.85); used += 1; }
    return used;
  }

  private emitEmberAt(x: number, y: number): void {
    this.spawnAt("ember", { x: x + (this.rand() - 0.5) * 0.36, y, vx: (this.rand() - 0.5) * 0.4, vy: -1.1 - this.rand() * 0.6, life: 1.25 });
  }

  private emitTorchFlame(x: number, y: number): void {
    this.spawnAt("flame", { x: x + (this.rand() - 0.5) * 0.14, y, vx: (this.rand() - 0.5) * 0.22, vy: -0.9 - this.rand() * 0.45, life: 0.36 + this.rand() * 0.18 });
    if (this.rand() < 0.3) this.emitEmberAt(x, y);
  }

  private spawnAmbientFloaters(input: ParticleStepInput, count: number): void {
    const isNight = input.dayNight.fireflyStrength > 0.22;
    for (let i = 0; i < count; i++) this.spawnSingleFloater(input, isNight);
  }

  private pickBiomeFloaterKind(biome: BiomeKind | undefined, isNight: boolean): ParticleKind {
    if (biome && (!isNight || biome !== "autumn-woods")) {
      const fn = BIOME_FLOATER_FN[biome];
      if (fn) return fn(this.rand());
    }
    return isNight ? "firefly" : this.rand() < 0.35 ? "leaf" : "mote";
  }

  private spawnSingleFloater(input: ParticleStepInput, isNight: boolean): void {
    const kind = this.pickBiomeFloaterKind(input.biome, isNight);
    const upward = kind === "spore" || kind === "ember" || kind === "wisp";
    const vxBase = isNight ? 0.55 : 0.7;
    const vy = upward ? -(0.28 + this.rand() * 0.35) : (isNight ? (this.rand() - 0.5) * 0.45 : 0.35 + this.rand() * 0.35);
    this.spawnAt(kind, {
      x: input.center.x + (this.rand() - 0.5) * 26, y: input.center.y + (this.rand() - 0.5) * 18,
      vx: (this.rand() - 0.5) * vxBase, vy, life: 3.8 + this.rand() * 2.5,
    });
  }

  private spawnAt(
    kind: ParticleKind,
    cfg: { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly life: number },
  ): void {
    const slot = this.acquireSlot();
    slot.kind = kind; slot.x = cfg.x; slot.y = cfg.y;
    slot.vx = cfg.vx; slot.vy = cfg.vy; slot.life = 0;
    slot.maxLife = cfg.life; slot.phase = this.rand() * 6.28; slot.active = true;
    applyParticleStyle(slot.sprite, kind, this.textures);
  }

  private stepSlot(slot: ParticleSlot, input: ParticleStepInput): void {
    slot.life += input.dt;
    if (slot.life >= slot.maxLife) { slot.active = false; slot.sprite.visible = false; return; }
    const progress = slot.life / slot.maxLife;
    if (slot.kind === "smoke") {
      const drag = Math.exp(-2.3 * input.dt);
      slot.vx *= drag; slot.vy = slot.vy * drag - 0.04 * input.dt;
      slot.x += slot.vx * input.dt; slot.y += slot.vy * input.dt;
      slot.sprite.position.set(slot.x * TILE_PX, slot.y * TILE_PX);
      const s = 0.48 + progress * 1.35;
      slot.sprite.scale.set(s, s * 0.9);
      slot.sprite.alpha = Math.sin(Math.min(0.5, progress) * Math.PI) * Math.pow(1 - progress, 1.35) * 0.76;
      return;
    }
    this.stepStandardSlot(slot, input, progress);
  }

  private stepStandardSlot(slot: ParticleSlot, input: ParticleStepInput, progress: number): void {
    const sway = slot.kind === "leaf" || slot.kind === "firefly" ? Math.sin(input.timeSec * 3.1 + slot.phase) * 0.35 : 0;
    slot.x += (slot.vx + sway) * input.dt; slot.y += slot.vy * input.dt;
    slot.sprite.position.set(slot.x * TILE_PX, slot.y * TILE_PX);
    if (slot.kind === "ripple") {
      const s = 0.4 + progress * 1.4;
      slot.sprite.scale.set(s, s * 0.65);
      slot.sprite.alpha = (1 - progress) * 0.65;
      return;
    }
    if (slot.kind === "flame") {
      slot.sprite.scale.set(0.36 * (1 - progress * 0.45), 0.54 * (1 - progress * 0.35));
      slot.sprite.alpha = (1 - progress) * 0.88;
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
