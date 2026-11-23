/** Composable 2.5D HD-pixel gore particle, emissive spark, and terrain-congruent decal system. */
import { TILE_PX, type GoreStyle, type GoreSubstance, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { GORE_TUNING } from "../combatVisualTuning.js";
import { ELEVATION_LIFT_PX } from "../../world/cliffStrips.js";
import { GoreDecalManager, type FootprintActor, type TileSampler } from "./goreDecals.js";
import { planGoreSpawn, type PlannedParticle, type PlannedParticleKind } from "./gorePatterns.js";
import { goreScaleForLevel, loadGoreLevel, saveGoreLevel, type GoreLevel } from "./gorePrefs.js";
import { getGoreTextures } from "./goreTextures.js";

interface Droplet {
  readonly sprite: Sprite; readonly landTex: Texture; readonly substance: GoreSubstance; readonly kind: PlannedParticleKind;
  x: number; y: number; z: number; elev: number; vx: number; vy: number; vz: number; rot: number;
  readonly vRot: number; readonly flipY: boolean; readonly scale: number; readonly alpha: number; readonly ttlSec: number;
  bouncesLeft: number; readonly bounceRestitution: number; readonly ephemeral: boolean; readonly ephemeralFadeSec: number;
  readonly flutter: boolean; readonly gravityMult: number; readonly phase: number;
  age: number; fadeAcc: number; fadingOut: boolean;
}

export interface GoreSpawnInput {
  readonly x: number; readonly y: number; readonly elevation?: number | undefined;
  readonly dirX: number; readonly dirY: number; readonly style: GoreStyle; readonly substance: GoreSubstance;
  readonly fatal?: boolean | undefined; readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined; readonly passiveDrip?: boolean | undefined; readonly cache?: TileSampler | undefined;
}

const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);

function pickItem<T>(list: readonly T[]): T { return list[Math.floor(Math.random() * list.length)]!; }

function initialDropScale(kind: PlannedParticleKind, scale: number): number {
  if (kind === "arc") return scale * 0.58;
  return kind === "chunk" ? scale * 0.85 : scale * 0.72;
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
  readonly sparkLayer = new Container();
  private readonly decals = new GoreDecalManager();
  private readonly droplets: Droplet[] = [];
  private maxDroplets: number = GORE_TUNING.maxDroplets;
  private level: GoreLevel = loadGoreLevel();
  private tileCache: TileSampler | undefined;
  private bleedAcc = 0;
  private lastArcIdx = -1;
  private lastSplatIdx = -1;

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
    const plan = planGoreSpawn(input, levelScale);
    const ox = input.x * TILE_PX;
    const oy = input.y * TILE_PX;
    const elev = input.elevation ?? 0;
    for (const p of plan.particles) this.pushDroplet({ plan: p, substance: input.substance, ox, oy, elev });
    if (plan.staticDecal) {
      this.decals.spawnStaticFeature({
        x: input.x, y: input.y, elevation: elev, kind: plan.staticDecal.kind,
        substance: input.substance, scaleMult: plan.staticDecal.scaleMult, cache: this.tileCache,
      });
    }
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

  private pickVaried<T>(list: readonly T[], prev: number): { readonly tex: T; readonly idx: number } {
    if (list.length <= 1) return { tex: list[0]!, idx: 0 };
    let idx = Math.floor(Math.random() * list.length);
    if (idx === prev) idx = (idx + 1) % list.length;
    return { tex: list[idx]!, idx };
  }

  private resolveTextures(kind: PlannedParticleKind, substance: GoreSubstance): { readonly air: Texture; readonly land: Texture } {
    const tex = getGoreTextures();
    const pal = GORE_TUNING.palettes[substance];
    if (kind === "arc") {
      const hit = this.pickVaried(tex.arcs, this.lastArcIdx);
      this.lastArcIdx = hit.idx;
      return { air: hit.tex, land: hit.tex };
    }
    if (kind === "spark") return { air: tex.spark, land: tex.spark };
    if (kind === "chunk") { const c = pickItem(tex.chunks[pal.chunkKind]); return { air: c, land: c }; }
    if (kind === "goop") return { air: tex.droplet, land: pickItem(tex.goopBlobs) };
    if (kind === "streak") return { air: tex.droplet, land: pickItem(tex.streaks) };
    const splat = this.pickVaried(tex.splatters, this.lastSplatIdx);
    this.lastSplatIdx = splat.idx;
    return { air: tex.droplet, land: splat.tex };
  }

  private emitPlayerDrip(p: PlayerSnapshot): void {
    if ((p.bleedTimer ?? 0) <= 0) return;
    this.spawn({ x: p.x, y: p.y, elevation: p.elevation, dirX: p.facingX, dirY: p.facingY, style: "drip", substance: "blood", passiveDrip: true });
  }

  private emitEntityDrip(e: WorldEntitySnapshot): void {
    if (e.hp <= 0 || e.corpse) return;
    const lowHpBleed = BLEED_SUBSTANCES.has(e.substance) && e.hp <= e.maxHp * 0.45 && Math.random() < 0.45;
    if (e.bleedTimer <= 0 && !lowHpBleed) return;
    this.spawn({ x: e.x, y: e.y, elevation: e.elevation, dirX: e.facingX, dirY: e.facingY, style: "drip", substance: e.substance, passiveDrip: true });
  }

  private createDroplet(opts: { readonly plan: PlannedParticle; readonly substance: GoreSubstance; readonly sprite: Sprite; readonly land: Texture; readonly ox: number; readonly oy: number; readonly elev: number }): Droplet {
    const { plan, substance, sprite, land, ox, oy, elev } = opts;
    return {
      sprite, landTex: land, substance, kind: plan.kind, x: ox, y: oy, z: plan.z0, elev,
      vx: Math.cos(plan.ang) * plan.spd, vy: Math.sin(plan.ang) * plan.spd, vz: plan.vz,
      rot: plan.rot ?? plan.ang, vRot: plan.spin, flipY: Boolean(plan.flipY), scale: plan.scale, alpha: plan.alpha, ttlSec: plan.ttlSec,
      bouncesLeft: plan.bounces, bounceRestitution: plan.bounceRestitution, ephemeral: plan.ephemeral,
      ephemeralFadeSec: plan.ephemeralFadeSec, flutter: plan.flutter, gravityMult: plan.gravityMult,
      phase: Math.random() * Math.PI * 2, age: 0, fadeAcc: 0, fadingOut: plan.kind === "spark",
    };
  }

  private pushDroplet(opts: { readonly plan: PlannedParticle; readonly substance: GoreSubstance; readonly ox: number; readonly oy: number; readonly elev: number }): void {
    if (this.droplets.length >= this.maxDroplets) this.droplets.shift()?.sprite.destroy();
    const { plan, substance, elev } = opts;
    const ox = opts.ox + (Math.random() - 0.5) * 6;
    const oy = opts.oy + (Math.random() - 0.5) * 4;
    const { air, land } = this.resolveTextures(plan.kind, substance);
    const sprite = new Sprite(air);
    sprite.anchor.set(0.5, 0.5);
    sprite.tint = pickItem(plan.colors ?? GORE_TUNING.palettes[substance].fresh);
    const initScale = initialDropScale(plan.kind, plan.scale);
    sprite.scale.set(initScale, plan.flipY ? -initScale : initScale);
    sprite.position.set(ox, oy - elev * ELEVATION_LIFT_PX - plan.z0);
    (plan.kind === "spark" ? this.sparkLayer : this.particleLayer).addChild(sprite);
    this.droplets.push(this.createDroplet({ plan, substance, sprite, land, ox, oy, elev }));
  }

  private stepDroplets(dt: number): void {
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      if (!this.stepSingleDroplet(this.droplets[i]!, dt)) {
        this.droplets[i]!.sprite.destroy();
        this.droplets.splice(i, 1);
      }
    }
  }

  private stepSingleDroplet(d: Droplet, dt: number): boolean {
    d.age += dt;
    this.advanceFlight(d, dt);
    if (d.fadingOut) {
      d.fadeAcc += dt;
      d.sprite.alpha = Math.max(0, d.alpha * (1 - d.fadeAcc / Math.max(0.05, d.ephemeralFadeSec)));
      return d.fadeAcc < d.ephemeralFadeSec;
    }
    if (d.z > 0) return true;
    if (this.tryDropOffCliff(d) || this.tryChunkBounce(d)) return true;
    if (d.ephemeral) {
      d.z = 0; d.vz = 0; d.vx *= 0.4; d.vy *= 0.4;
      d.fadingOut = true;
      return true;
    }
    this.settleDroplet(d);
    return false;
  }

  private advanceFlight(d: Droplet, dt: number): void {
    if (d.flutter) { d.vx *= Math.max(0, 1 - dt * 2.4); d.x += Math.sin(d.age * 11 + d.phase) * 18 * dt; }
    if (d.fadingOut && d.kind !== "spark") { d.vx *= Math.max(0, 1 - dt * 8); d.vy *= Math.max(0, 1 - dt * 8); }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vz -= GORE_TUNING.gravityPx * d.gravityMult * dt;
    d.z = Math.max(0, d.z + d.vz * dt);
    d.rot = d.kind === "spark" ? Math.atan2(d.vy, d.vx) : d.rot + d.vRot * dt;
    d.sprite.rotation = d.rot;
    if (d.kind === "arc") {
      const s = d.scale * Math.min(1, 0.58 + d.age * 3.5);
      d.sprite.scale.set(s, d.flipY ? -s : s);
    }
    d.sprite.position.set(d.x, d.y - d.elev * ELEVATION_LIFT_PX - d.z);
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
    d.vz = Math.max(14, Math.abs(d.vz) * d.bounceRestitution);
    d.vx *= 0.52;
    d.vy *= 0.52;
    if (!GORE_TUNING.palettes[d.substance].solid && !d.ephemeral) {
      this.decals.stampSurface({
        tileX: d.x / TILE_PX, tileY: d.y / TILE_PX, elevation: d.elev, texture: pickItem(getGoreTextures().splatters),
        scale: d.scale * 0.5, rot: d.rot, alpha: d.alpha * 0.65, ttl: d.ttlSec * 0.7, substance: d.substance, cache: this.tileCache,
      });
    }
    return true;
  }

  private settleDroplet(d: Droplet): void {
    const scale = d.kind === "chunk" ? d.scale * 0.8 : d.scale;
    const rot = d.kind === "streak" ? Math.atan2(d.vy, d.vx) : d.rot;
    this.decals.stampSurface({
      tileX: d.x / TILE_PX, tileY: d.y / TILE_PX, elevation: d.elev, texture: d.landTex,
      scale, flipY: d.flipY, rot, alpha: d.alpha, ttl: d.ttlSec, substance: d.substance, cache: this.tileCache,
    });
  }
}
