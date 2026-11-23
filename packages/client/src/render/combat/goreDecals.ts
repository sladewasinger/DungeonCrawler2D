/** Manages terrain-congruent drying gore decals, water plumes, expanding pools, and footprints. */
import { GroundKind, TILE_PX, type GoreSubstance, type WorldChunkCache } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { GORE_TUNING } from "./combatVisualTuning.js";
import { getGoreTextures } from "./goreTextures.js";

export type TileSampler = Pick<WorldChunkCache, "tileAt">;

export interface SurfaceDecalInput {
  readonly tileX: number;
  readonly tileY: number;
  readonly elevation: number;
  readonly texture: Texture;
  readonly scale: number;
  readonly rot: number;
  readonly alpha: number;
  readonly ttl: number;
  readonly substance: GoreSubstance;
  readonly cache?: TileSampler | undefined;
}

export interface PoolInput {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly substance: GoreSubstance;
  readonly scaleMult?: number | undefined;
  readonly cache?: TileSampler | undefined;
}

export interface FootprintActor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly jumpZ?: number | undefined;
  readonly inWater?: boolean | undefined;
  readonly alive: boolean;
}

interface GoreDecal {
  readonly sprite: Sprite;
  age: number;
  readonly ttl: number;
  readonly baseAlpha: number;
  readonly freshColor: number;
  readonly driedColor: number;
  readonly solid: boolean;
  readonly baseScale: number;
  readonly growFrom: number;
  readonly growTo: number;
  readonly growDuration: number;
  readonly driftVx: number;
  readonly driftVy: number;
}

interface FreshPuddle {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly substance: GoreSubstance;
  age: number;
}

interface FootTrack {
  prevX: number;
  prevY: number;
  wetSteps: number;
  distAcc: number;
  side: number;
  substance: GoreSubstance;
}

function lerpRgb(c0: number, c1: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((c0 >> 16) & 0xff) * (1 - k) + ((c1 >> 16) & 0xff) * k);
  const g = Math.round(((c0 >> 8) & 0xff) * (1 - k) + ((c1 >> 8) & 0xff) * k);
  const b = Math.round((c0 & 0xff) * (1 - k) + (c1 & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}

function pickColors(substance: GoreSubstance): { readonly fresh: number; readonly dried: number; readonly solid: boolean } {
  const pal = GORE_TUNING.palettes[substance];
  const fi = Math.floor(Math.random() * pal.fresh.length);
  const di = Math.floor(Math.random() * pal.dried.length);
  return { fresh: pal.fresh[fi] ?? pal.fresh[0]!, dried: pal.dried[di] ?? pal.dried[0]!, solid: pal.solid };
}

function isWaterTile(cache: TileSampler | undefined, tileX: number, tileY: number): boolean {
  if (!cache) return false;
  const g = cache.tileAt(Math.floor(tileX), Math.floor(tileY)).ground;
  return g === GroundKind.ShallowWater || g === GroundKind.DeepWater;
}

function stepSingleDecal(dc: GoreDecal, dt: number): boolean {
  dc.age += dt;
  if (dc.age >= dc.ttl) { dc.sprite.destroy(); return false; }
  if (dc.driftVx !== 0 || dc.driftVy !== 0) {
    dc.sprite.position.x += dc.driftVx * dt;
    dc.sprite.position.y += dc.driftVy * dt;
  }
  if (dc.growDuration > 0) {
    const gt = Math.min(1, dc.age / dc.growDuration);
    const eased = 1 - Math.pow(1 - gt, 2.2);
    dc.sprite.scale.set(dc.baseScale * (dc.growFrom + (dc.growTo - dc.growFrom) * eased));
  }
  if (!dc.solid) dc.sprite.tint = lerpRgb(dc.freshColor, dc.driedColor, dc.age / GORE_TUNING.dryDurationSec);
  const fadeStart = Math.max(0, dc.ttl - GORE_TUNING.decalFadeSec);
  dc.sprite.alpha = dc.age > fadeStart ? dc.baseAlpha * (1 - (dc.age - fadeStart) / Math.max(0.1, dc.ttl - fadeStart)) : dc.baseAlpha;
  return true;
}

export class GoreDecalManager {
  readonly groundLayer = new Container();
  private elevatedHost: Container | null = null;
  private readonly decals: GoreDecal[] = [];
  private readonly puddles: FreshPuddle[] = [];
  private readonly footTracks = new Map<string, FootTrack>();
  private maxDecals: number = GORE_TUNING.maxDecals;

  attachElevatedLayer(host: Container): void { this.elevatedHost = host; }
  setMaxDecals(limit: number): void { this.maxDecals = Math.max(0, limit); this.trimExcess(); }

  clear(): void {
    for (const dc of this.decals) dc.sprite.destroy();
    this.decals.length = 0;
    this.puddles.length = 0;
    this.footTracks.clear();
  }

  stampSurface(input: SurfaceDecalInput): void {
    if (this.maxDecals <= 0) return;
    const pal = pickColors(input.substance);
    if (!pal.solid && isWaterTile(input.cache, input.tileX, input.tileY)) {
      this.spawnWaterPlume(input, pal);
      return;
    }
    this.trimForNext();
    const sprite = new Sprite(input.texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(input.scale);
    sprite.rotation = input.rot;
    sprite.tint = pal.fresh;
    sprite.alpha = input.alpha;
    this.mountSprite(sprite, { tileX: input.tileX, tileY: input.tileY, elevation: input.elevation });
    this.decals.push({
      sprite, age: 0, ttl: input.ttl, baseAlpha: input.alpha, freshColor: pal.fresh, driedColor: pal.dried,
      solid: pal.solid, baseScale: input.scale, growFrom: 1, growTo: 1, growDuration: 0, driftVx: 0, driftVy: 0,
    });
    if (!pal.solid && input.scale >= 0.45) this.pushPuddle({ x: input.tileX, y: input.tileY, elevation: input.elevation, substance: input.substance });
  }

  spawnPool(opts: PoolInput): void {
    if (this.maxDecals <= 0) return;
    const pal = pickColors(opts.substance);
    if (pal.solid || isWaterTile(opts.cache, opts.x, opts.y)) return;
    this.trimForNext();
    const tex = getGoreTextures().pools[Math.floor(Math.random() * 2)]!;
    const baseScale = (0.55 + Math.random() * 0.2) * (opts.scaleMult ?? 1);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(baseScale * 0.32);
    sprite.rotation = (Math.random() - 0.5) * 0.55;
    sprite.tint = pal.fresh;
    sprite.alpha = 0.86;
    this.mountSprite(sprite, { tileX: opts.x, tileY: opts.y, elevation: opts.elevation });
    this.decals.push({
      sprite, age: 0, ttl: GORE_TUNING.decalTtlSec, baseAlpha: 0.86, freshColor: pal.fresh, driedColor: pal.dried,
      solid: false, baseScale, growFrom: 0.32, growTo: 1.15, growDuration: 2.2, driftVx: 0, driftVy: 0,
    });
    this.pushPuddle({ x: opts.x, y: opts.y, elevation: opts.elevation, substance: opts.substance });
  }

  step(dt: number): void {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      if (!stepSingleDecal(this.decals[i]!, dt)) this.decals.splice(i, 1);
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      this.puddles[i]!.age += dt;
      if (this.puddles[i]!.age >= 18) this.puddles.splice(i, 1);
    }
  }

  stepFootprints(actors: readonly FootprintActor[], cache?: TileSampler): void {
    for (const a of actors) this.updateActorTrack(a, cache);
  }

  private updateActorTrack(a: FootprintActor, cache?: TileSampler): void {
    if (!a.alive || (a.jumpZ ?? 0) > 0.05 || a.inWater || isWaterTile(cache, a.x, a.y)) {
      this.footTracks.delete(a.id);
      return;
    }
    const near = this.findFreshPuddle(a.x, a.y, a.elevation);
    const tr = this.footTracks.get(a.id) ?? this.createTrack(a);
    if (near) { tr.wetSteps = 4; tr.substance = near.substance; }
    this.advanceTrackMovement(tr, a, cache);
  }

  private createTrack(a: FootprintActor): FootTrack {
    const tr: FootTrack = { prevX: a.x, prevY: a.y, wetSteps: 0, distAcc: 0, side: 1, substance: "blood" };
    this.footTracks.set(a.id, tr);
    return tr;
  }

  private advanceTrackMovement(tr: FootTrack, a: FootprintActor, cache?: TileSampler): void {
    const dx = a.x - tr.prevX;
    const dy = a.y - tr.prevY;
    tr.prevX = a.x;
    tr.prevY = a.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.002 || d > 2.5 || tr.wetSteps <= 0) return;
    tr.distAcc += d;
    if (tr.distAcc < 0.45) return;
    tr.distAcc = 0;
    this.stampFootprint({ a, tr, ang: Math.atan2(dy, dx), cache });
  }

  private stampFootprint(opts: { readonly a: FootprintActor; readonly tr: FootTrack; readonly ang: number; readonly cache?: TileSampler | undefined }): void {
    const { a, tr, ang } = opts;
    const tex = getGoreTextures().footprints[Math.floor(Math.random() * 2)]!;
    const offX = (-Math.sin(ang) * tr.side * 1.4) / TILE_PX;
    const offY = (Math.cos(ang) * tr.side * 1.4) / TILE_PX;
    tr.side *= -1;
    this.stampSurface({
      tileX: a.x + offX, tileY: a.y + offY, elevation: a.elevation, texture: tex, scale: 0.44, rot: ang,
      alpha: 0.24 + tr.wetSteps * 0.1, ttl: 28, substance: tr.substance, cache: opts.cache,
    });
    tr.wetSteps -= 1;
  }

  private findFreshPuddle(x: number, y: number, elev: number): FreshPuddle | null {
    for (const p of this.puddles) {
      if (p.elevation === elev && Math.hypot(p.x - x, p.y - y) <= 0.62) return p;
    }
    return null;
  }

  private pushPuddle(opts: { readonly x: number; readonly y: number; readonly elevation: number; readonly substance: GoreSubstance }): void {
    if (this.puddles.length >= 64) this.puddles.shift();
    this.puddles.push({ ...opts, age: 0 });
  }

  private spawnWaterPlume(input: SurfaceDecalInput, pal: { readonly fresh: number; readonly dried: number }): void {
    this.trimForNext();
    const sprite = new Sprite(getGoreTextures().waterPlume);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(0.45);
    sprite.rotation = Math.random() * Math.PI * 2;
    sprite.tint = pal.fresh;
    sprite.alpha = 0.56;
    this.mountSprite(sprite, { tileX: input.tileX, tileY: input.tileY, elevation: input.elevation });
    this.decals.push({
      sprite, age: 0, ttl: 4.5, baseAlpha: 0.56, freshColor: pal.fresh, driedColor: pal.dried,
      solid: false, baseScale: 1, growFrom: 0.45, growTo: 1.85, growDuration: 4.2, driftVx: 2.2, driftVy: 0.6,
    });
  }

  private mountSprite(sprite: Sprite, pos: { readonly tileX: number; readonly tileY: number; readonly elevation: number }): void {
    sprite.position.set(pos.tileX * TILE_PX, pos.tileY * TILE_PX - pos.elevation * ELEVATION_LIFT_PX);
    if (pos.elevation >= 1 && this.elevatedHost) {
      sprite.zIndex = Math.floor(pos.tileY) * TILE_PX + pos.elevation;
      this.elevatedHost.addChild(sprite);
      return;
    }
    this.groundLayer.addChild(sprite);
  }

  private trimForNext(): void {
    while (this.decals.length >= this.maxDecals && this.decals.length > 0) {
      this.decals.shift()!.sprite.destroy();
    }
  }

  private trimExcess(): void {
    while (this.decals.length > this.maxDecals) this.decals.shift()!.sprite.destroy();
  }
}
