/** Composable 2.5D HD-pixel gore particle + terrain-congruent decal system. */
import { TILE_PX, type GoreStyle, type GoreSubstance, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { GORE_TUNING, type GoreStyleTuning } from "./combatVisualTuning.js";
import { GoreDecalManager, type FootprintActor, type TileSampler } from "./goreDecals.js";
import { goreScaleForLevel, loadGoreLevel, saveGoreLevel, type GoreLevel } from "./gorePrefs.js";
import { getGoreTextures } from "./goreTextures.js";

type StyleConfig = GoreStyleTuning;
type DropKind = "splat" | "streak" | "chunk";

interface Droplet {
  readonly sprite: Sprite;
  readonly landTex: Texture;
  readonly substance: GoreSubstance;
  readonly kind: DropKind;
  x: number;
  y: number;
  z: number;
  elev: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vRot: number;
  readonly scale: number;
  readonly alpha: number;
  readonly ttlSec: number;
  bouncesLeft: number;
}

export interface GoreSpawnInput {
  readonly x: number;
  readonly y: number;
  readonly elevation?: number | undefined;
  readonly dirX: number;
  readonly dirY: number;
  readonly style: GoreStyle;
  readonly substance: GoreSubstance;
  readonly fatal?: boolean | undefined;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly cache?: TileSampler | undefined;
}

const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);

function pickItem<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function sweepAngle(opts: { readonly base: number; readonly spread: number; readonly sweepDir: number; readonly frac: number }): number {
  if (opts.sweepDir === 0) return opts.base + (Math.random() - 0.5) * opts.spread;
  return opts.base + opts.sweepDir * (-0.38 + opts.frac * 1.48) + (Math.random() - 0.5) * 0.42;
}

function dropSpeed(baseSpd: number, kind: DropKind): number {
  if (kind === "streak") return baseSpd * (0.9 + Math.random() * 0.55);
  if (kind === "chunk") return baseSpd * (0.55 + Math.random() * 0.55);
  return baseSpd * (0.4 + Math.random() * 0.8);
}

function buildFootActors(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[]): FootprintActor[] {
  const out: FootprintActor[] = [];
  for (const p of players) {
    out.push({ id: p.id, x: p.x, y: p.y, elevation: p.elevation, jumpZ: p.jumpZ, inWater: p.inWater, alive: (p.respawnTimer ?? 0) <= 0 });
  }
  for (const e of entities) {
    out.push({ id: e.id, x: e.x, y: e.y, elevation: e.elevation, jumpZ: e.jumpZ, alive: !e.corpse && e.hp > 0 });
  }
  return out;
}

export class GoreSystem {
  readonly particleLayer = new Container();
  private readonly decals = new GoreDecalManager();
  private readonly droplets: Droplet[] = [];
  private maxDroplets: number = GORE_TUNING.maxDroplets;
  private level: GoreLevel = loadGoreLevel();
  private tileCache: TileSampler | undefined;
  private bleedAcc = 0;

  get decalLayer(): Container { return this.decals.groundLayer; }
  attachElevatedLayer(host: Container): void { this.decals.attachElevatedLayer(host); }
  setTileSampler(cache: TileSampler | undefined): void { this.tileCache = cache; }

  setQualityBudget(budget: { readonly maxDecals: number; readonly maxGoreParticles: number }): void {
    this.decals.setMaxDecals(budget.maxDecals);
    this.maxDroplets = budget.maxGoreParticles;
    while (this.droplets.length > this.maxDroplets) this.droplets.shift()?.sprite.destroy();
  }

  setGoreLevel(level: GoreLevel): void {
    this.level = level;
    saveGoreLevel(level);
    if (level === "off") this.clear();
  }

  spawn(input: GoreSpawnInput): void {
    const levelScale = goreScaleForLevel(this.level);
    if (levelScale <= 0) return;
    if (input.cache) this.tileCache = input.cache;
    const cfg = GORE_TUNING.styles[input.style];
    const pal = GORE_TUNING.palettes[input.substance];
    const base = Math.atan2(input.dirY || 0.01, input.dirX || 1);
    const boost = input.fatal || input.comboStep === 3 ? 1.55 : 1;
    this.spawnBurst({ input, cfg, pal: pal.fresh, chunkKind: pal.chunkKind, base, sweepDir: input.sweepDir ?? 0, boost, levelScale });
    this.maybeSpawnFatalPool(input, pal.solid);
  }

  private maybeSpawnFatalPool(input: GoreSpawnInput, solid: boolean): void {
    if (!input.fatal || solid) return;
    this.decals.spawnPool({
      x: input.x, y: input.y, elevation: input.elevation ?? 0, substance: input.substance,
      scaleMult: input.style === "explode-away" ? 1.28 : 1, cache: this.tileCache,
    });
  }

  step(dt: number): void {
    this.stepDroplets(dt);
    this.decals.step(dt);
  }

  stepBleedDrips(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[], dt: number): void {
    if (this.level === "off") return;
    this.bleedAcc += dt;
    if (this.bleedAcc < GORE_TUNING.bleedDripIntervalSec) return;
    this.bleedAcc = 0;
    for (const p of players) this.emitPlayerDrip(p);
    for (const e of entities) this.emitEntityDrip(e);
  }

  stepFootprints(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[]): void {
    if (this.level === "off") return;
    this.decals.stepFootprints(buildFootActors(players, entities), this.tileCache);
  }

  clear(): void {
    for (const d of this.droplets) d.sprite.destroy();
    this.droplets.length = 0;
    this.decals.clear();
  }

  private spawnBurst(opts: {
    readonly input: GoreSpawnInput; readonly cfg: StyleConfig; readonly pal: readonly number[];
    readonly chunkKind: "soft" | "bone" | "stone" | "straw"; readonly base: number;
    readonly sweepDir: number; readonly boost: number; readonly levelScale: number;
  }): void {
    const tex = getGoreTextures();
    const ox = opts.input.x * TILE_PX;
    const oy = opts.input.y * TILE_PX;
    const elev = opts.input.elevation ?? 0;
    const counts = {
      splats: Math.max(1, Math.round(opts.cfg.count * opts.boost * opts.levelScale)),
      streaks: Math.round(opts.cfg.streaks * opts.boost * opts.levelScale),
      chunks: Math.round((opts.cfg.chunks + (opts.input.fatal ? 3 : 0)) * opts.levelScale),
    };
    this.emitGroup({ kind: "splat", count: counts.splats, texList: tex.splatters, ox, oy, elev, opts });
    this.emitGroup({ kind: "streak", count: counts.streaks, texList: tex.streaks, ox, oy, elev, opts });
    this.emitGroup({ kind: "chunk", count: counts.chunks, texList: tex.chunks[opts.chunkKind], ox, oy, elev, opts });
  }

  private emitGroup(ctx: {
    readonly kind: DropKind; readonly count: number; readonly texList: readonly Texture[];
    readonly ox: number; readonly oy: number; readonly elev: number;
    readonly opts: Parameters<GoreSystem["spawnBurst"]>[0];
  }): void {
    const { cfg, pal, base, sweepDir, input } = ctx.opts;
    for (let i = 0; i < ctx.count; i++) {
      const ang = sweepAngle({ base, spread: cfg.spread, sweepDir, frac: i / Math.max(1, ctx.count - 1) });
      const spd = dropSpeed(cfg.speed, ctx.kind);
      const scale = cfg.minScale + Math.random() * (cfg.maxScale - cfg.minScale);
      this.pushDroplet({
        kind: ctx.kind, landTex: pickItem(ctx.texList), substance: input.substance,
        x: ctx.ox, y: ctx.oy, elev: ctx.elev, ang, spd, scale, color: pickItem(pal), cfg,
      });
    }
  }

  private emitPlayerDrip(p: PlayerSnapshot): void {
    if ((p.bleedTimer ?? 0) <= 0) return;
    this.spawn({ x: p.x, y: p.y, elevation: p.elevation, dirX: p.facingX, dirY: p.facingY, style: "drip", substance: "blood" });
  }

  private emitEntityDrip(e: WorldEntitySnapshot): void {
    if (e.hp <= 0 || e.corpse) return;
    const lowHpBleed = BLEED_SUBSTANCES.has(e.substance) && e.hp <= e.maxHp * 0.45 && Math.random() < 0.45;
    if (e.bleedTimer <= 0 && !lowHpBleed) return;
    this.spawn({ x: e.x, y: e.y, elevation: e.elevation, dirX: e.facingX, dirY: e.facingY, style: "drip", substance: e.substance });
  }

  private pushDroplet(p: {
    readonly kind: DropKind; readonly landTex: Texture; readonly substance: GoreSubstance;
    readonly x: number; readonly y: number; readonly elev: number;
    readonly ang: number; readonly spd: number; readonly scale: number;
    readonly color: number; readonly cfg: StyleConfig;
  }): void {
    if (this.droplets.length >= this.maxDroplets) this.droplets.shift()?.sprite.destroy();
    const tex = getGoreTextures();
    const sprite = new Sprite(p.kind === "chunk" ? p.landTex : tex.droplet);
    sprite.anchor.set(0.5, 0.5);
    sprite.tint = p.color;
    sprite.scale.set(p.kind === "chunk" ? p.scale * 0.82 : p.scale * 0.72);
    sprite.position.set(p.x, p.y - p.elev * ELEVATION_LIFT_PX - 7);
    this.particleLayer.addChild(sprite);
    this.droplets.push({
      sprite, landTex: p.landTex, substance: p.substance, kind: p.kind,
      x: p.x, y: p.y, z: 6 + Math.random() * 6, elev: p.elev,
      vx: Math.cos(p.ang) * p.spd, vy: Math.sin(p.ang) * p.spd,
      vz: p.cfg.vz * (0.55 + Math.random() * 0.7) * (p.kind === "streak" ? 0.55 : 1),
      rot: p.ang, vRot: p.kind === "chunk" ? (Math.random() - 0.5) * 14 : 0,
      scale: p.scale, alpha: p.cfg.decalAlpha, ttlSec: p.cfg.ttlSec, bouncesLeft: p.kind === "chunk" ? 1 : 0,
    });
  }

  private stepDroplets(dt: number): void {
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i]!;
      this.advanceDroplet(d, dt);
      if (d.z > 0) continue;
      if (this.tryDropOffCliff(d) || this.tryChunkBounce(d)) continue;
      this.settleDroplet(d);
      d.sprite.destroy();
      this.droplets.splice(i, 1);
    }
  }

  private advanceDroplet(d: Droplet, dt: number): void {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vz -= GORE_TUNING.gravityPx * dt;
    d.z += d.vz * dt;
    d.rot += d.vRot * dt;
    d.sprite.rotation = d.rot;
    d.sprite.position.set(d.x, d.y - d.elev * ELEVATION_LIFT_PX - Math.max(0, d.z));
  }

  private tryDropOffCliff(d: Droplet): boolean {
    if (!this.tileCache) return false;
    const tileElev = this.tileCache.tileAt(Math.floor(d.x / TILE_PX), Math.floor(d.y / TILE_PX)).elevation;
    if (tileElev >= d.elev) return false;
    d.z += (d.elev - tileElev) * ELEVATION_LIFT_PX;
    d.elev = tileElev;
    return d.z > 0;
  }

  private tryChunkBounce(d: Droplet): boolean {
    if (d.bouncesLeft <= 0) return false;
    d.bouncesLeft -= 1;
    d.z = 1;
    d.vz = Math.max(18, Math.abs(d.vz) * 0.38);
    d.vx *= 0.52;
    d.vy *= 0.52;
    this.decals.stampSurface({
      tileX: d.x / TILE_PX, tileY: d.y / TILE_PX, elevation: d.elev,
      texture: pickItem(getGoreTextures().splatters), scale: d.scale * 0.55,
      rot: d.rot, alpha: d.alpha * 0.65, ttl: d.ttlSec * 0.7, substance: d.substance, cache: this.tileCache,
    });
    return true;
  }

  private settleDroplet(d: Droplet): void {
    this.decals.stampSurface({
      tileX: d.x / TILE_PX, tileY: d.y / TILE_PX, elevation: d.elev,
      texture: d.landTex, scale: d.kind === "chunk" ? d.scale * 0.8 : d.scale,
      rot: d.kind === "streak" ? Math.atan2(d.vy, d.vx) : d.rot,
      alpha: d.alpha, ttl: d.ttlSec, substance: d.substance, cache: this.tileCache,
    });
  }
}
