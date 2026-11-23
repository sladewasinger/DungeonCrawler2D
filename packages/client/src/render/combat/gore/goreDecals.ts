/** Manages terrain-congruent drying decals, diffuse water clouds, corpse piles/pools, and footprints. */
import { TILE_PX, type GoreSubstance } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { GORE_TUNING } from "../combatVisualTuning.js";
import { ELEVATION_LIFT_PX } from "../../world/cliffStrips.js";
import {
  isWaterTile, pickGoreColors, resolveFeatureSpec, stepSingleDecal, type GoreDecal, type TileSampler,
} from "./goreDecalHelpers.js";
import type { StaticFeatureKind } from "./gorePatterns.js";
import { getGoreTextures } from "./goreTextures.js";

export type { TileSampler } from "./goreDecalHelpers.js";

function buildStaticFeatureSprite(opts: {
  readonly feat: ReturnType<typeof resolveFeatureSpec>;
  readonly pal: ReturnType<typeof pickGoreColors>;
  readonly scale: number;
}): Sprite {
  const { feat, pal, scale } = opts;
  const sprite = new Sprite(feat.tex);
  sprite.anchor.set(0.5, 0.5);
  sprite.scale.set(scale * feat.growFrom);
  sprite.rotation = feat.trackPuddle ? (Math.random() - 0.5) * 0.45 : (Math.random() - 0.5) * 0.18;
  sprite.tint = feat.tintOverride ?? pal.fresh;
  sprite.alpha = feat.tintOverride !== undefined ? 0.84 : pal.solid ? 0.96 : 0.88;
  return sprite;
}

export interface SurfaceDecalInput {
  readonly tileX: number;
  readonly tileY: number;
  readonly elevation: number;
  readonly texture: Texture;
  readonly scale: number;
  readonly flipY?: boolean | undefined;
  readonly rot: number;
  readonly alpha: number;
  readonly ttl: number;
  readonly substance: GoreSubstance;
  readonly cache?: TileSampler | undefined;
}

export interface StaticFeatureInput {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly kind: StaticFeatureKind;
  readonly substance: GoreSubstance;
  readonly scaleMult: number;
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

export class GoreDecalManager {
  readonly groundLayer = new Container();
  private elevatedHost: Container | null = null;
  private readonly decals: GoreDecal[] = [];
  private readonly puddles: FreshPuddle[] = [];
  private readonly footTracks = new Map<string, FootTrack>();
  private maxDecals: number = GORE_TUNING.maxDecals;

  attachElevatedLayer(host: Container): void { this.elevatedHost = host; }
  setMaxDecals(limit: number): void { this.maxDecals = Math.max(0, limit); this.trimExcess(); }
  shrinkToRatio(ratio: number): void {
    const target = Math.max(0, Math.round(this.decals.length * ratio));
    while (this.decals.length > target) this.decals.shift()?.sprite.destroy();
  }

  clear(): void {
    for (const dc of this.decals) dc.sprite.destroy();
    this.decals.length = 0;
    this.puddles.length = 0;
    this.footTracks.clear();
  }

  stampSurface(input: SurfaceDecalInput): void {
    if (this.maxDecals <= 0) return;
    const pal = pickGoreColors(input.substance);
    if (!pal.solid && isWaterTile(input.cache, input.tileX, input.tileY)) {
      this.spawnWaterPlume(input, pal);
      return;
    }
    this.trimForNext();
    const sprite = new Sprite(input.texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(input.scale, input.flipY ? -input.scale : input.scale);
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

  spawnStaticFeature(opts: StaticFeatureInput): void {
    if (this.maxDecals <= 0) return;
    const pal = pickGoreColors(opts.substance);
    if (!pal.solid && isWaterTile(opts.cache, opts.x, opts.y)) return;
    this.trimForNext();
    const feat = resolveFeatureSpec(opts.kind);
    const scale = feat.baseScale * opts.scaleMult * (0.94 + Math.random() * 0.14);
    const sprite = buildStaticFeatureSprite({ feat, pal, scale });
    this.mountSprite(sprite, { tileX: opts.x, tileY: opts.y, elevation: opts.elevation });
    this.decals.push({
      sprite, age: 0, ttl: GORE_TUNING.decalTtlSec, baseAlpha: sprite.alpha, freshColor: pal.fresh, driedColor: pal.dried,
      solid: pal.solid, baseScale: scale, growFrom: feat.growFrom, growTo: feat.growTo, growDuration: feat.growDur, driftVx: 0, driftVy: 0,
    });
    if (feat.trackPuddle) this.pushPuddle({ x: opts.x, y: opts.y, elevation: opts.elevation, substance: opts.substance });
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
    const plumes = getGoreTextures().waterPlumes;
    const sprite = new Sprite(plumes[Math.floor(Math.random() * plumes.length)]!);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(0.55);
    sprite.rotation = Math.random() * Math.PI * 2;
    sprite.tint = pal.fresh;
    sprite.alpha = 0.62;
    this.mountSprite(sprite, { tileX: input.tileX, tileY: input.tileY, elevation: input.elevation });
    this.decals.push({
      sprite, age: 0, ttl: 4.8, baseAlpha: 0.62, freshColor: pal.fresh, driedColor: pal.dried,
      solid: false, baseScale: 1, growFrom: 0.55, growTo: 1.95, growDuration: 4.5, driftVx: 2.0, driftVy: 0.5,
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
    while (this.decals.length >= this.maxDecals && this.decals.length > 0) this.decals.shift()!.sprite.destroy();
  }

  private trimExcess(): void {
    while (this.decals.length > this.maxDecals) this.decals.shift()!.sprite.destroy();
  }
}
