/** Composable 2.5D gore particle + persistent ground decal system (GoreStyle x GoreSubstance). */
import { TILE_PX, type GoreStyle, type GoreSubstance, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { GORE_TUNING, type GoreStyleTuning } from "./combatVisualTuning.js";

type StyleConfig = GoreStyleTuning;

interface Droplet {
  readonly g: Graphics;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  stretch: number;
  color: number;
  alpha: number;
  ttlSec: number;
  rot: number;
}

interface Decal {
  readonly g: Graphics;
  age: number;
  ttl: number;
  baseAlpha: number;
}

export interface GoreSpawnInput {
  readonly x: number;
  readonly y: number;
  readonly elevation?: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly style: GoreStyle;
  readonly substance: GoreSubstance;
}

export class GoreSystem {
  readonly decalLayer = new Container();
  readonly particleLayer = new Container();
  private readonly droplets: Droplet[] = [];
  private readonly decals: Decal[] = [];
  private bleedAcc = 0;

  spawn(input: GoreSpawnInput): void {
    const cfg = GORE_TUNING.styles[input.style];
    const palette = GORE_TUNING.palettes[input.substance];
    const baseAngle = Math.atan2(input.dirY || 0.01, input.dirX || 1);
    const liftY = (input.elevation ?? 0) * ELEVATION_LIFT_PX;
    const ox = input.x * TILE_PX;
    const oy = input.y * TILE_PX - liftY;
    for (let i = 0; i < cfg.count; i++) {
      const ang = baseAngle + (Math.random() - 0.5) * cfg.spread;
      const spd = cfg.speed * (0.45 + Math.random() * 0.75);
      const r = cfg.minR + Math.random() * (cfg.maxR - cfg.minR);
      const color = palette[Math.floor(Math.random() * palette.length)]!;
      this.pushDroplet({ x: ox, y: oy, ang, spd, r, color, cfg });
    }
  }

  step(dt: number): void {
    this.stepDroplets(dt);
    this.stepDecals(dt);
  }

  stepBleedDrips(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[], dt: number): void {
    this.bleedAcc += dt;
    if (this.bleedAcc < GORE_TUNING.bleedDripIntervalSec) return;
    this.bleedAcc = 0;
    for (const p of players) this.emitPlayerDrip(p);
    for (const e of entities) this.emitEntityDrip(e);
  }

  private emitPlayerDrip(p: PlayerSnapshot): void {
    if ((p.bleedTimer ?? 0) <= 0) return;
    this.spawn({ x: p.x, y: p.y, elevation: p.elevation, dirX: p.facingX, dirY: p.facingY, style: "drip", substance: "blood" });
  }

  private emitEntityDrip(e: WorldEntitySnapshot): void {
    if (e.bleedTimer <= 0 || e.hp <= 0) return;
    this.spawn({ x: e.x, y: e.y, elevation: e.elevation, dirX: e.facingX, dirY: e.facingY, style: "drip", substance: e.substance });
  }

  clear(): void {
    for (const d of this.droplets) d.g.destroy();
    for (const dc of this.decals) dc.g.destroy();
    this.droplets.length = 0;
    this.decals.length = 0;
  }

  private pushDroplet(p: {
    readonly x: number; readonly y: number; readonly ang: number; readonly spd: number;
    readonly r: number; readonly color: number; readonly cfg: StyleConfig;
  }): void {
    if (this.droplets.length >= GORE_TUNING.maxDroplets) this.droplets.shift()?.g.destroy();
    const g = new Graphics();
    g.circle(0, 0, Math.max(0.8, p.r * 0.85)).fill({ color: p.color, alpha: 0.92 });
    g.position.set(p.x, p.y - 6);
    this.particleLayer.addChild(g);
    this.droplets.push({
      g, x: p.x, y: p.y, z: 7 + Math.random() * 5,
      vx: Math.cos(p.ang) * p.spd, vy: Math.sin(p.ang) * p.spd,
      vz: p.cfg.vz * (0.6 + Math.random() * 0.7),
      radius: p.r, stretch: p.cfg.stretch, color: p.color,
      alpha: p.cfg.decalAlpha, ttlSec: p.cfg.ttlSec, rot: p.ang,
    });
  }

  private stepDroplets(dt: number): void {
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i]!;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vz -= GORE_TUNING.gravityPx * dt;
      d.z += d.vz * dt;
      d.g.position.set(d.x, d.y - Math.max(0, d.z));
      if (d.z <= 0) {
        this.stampDecal(d);
        d.g.destroy();
        this.droplets.splice(i, 1);
      }
    }
  }

  private stampDecal(d: Droplet): void {
    let g: Graphics;
    if (this.decals.length >= GORE_TUNING.maxDecals) {
      g = this.decals.shift()!.g;
      g.clear();
    } else {
      g = new Graphics();
      this.decalLayer.addChild(g);
    }
    g.ellipse(0, 0, d.radius * d.stretch, d.radius * (d.stretch > 2 ? 0.55 : 0.78))
      .fill({ color: d.color, alpha: 1 });
    g.position.set(d.x, d.y);
    g.rotation = d.rot;
    g.alpha = d.alpha;
    this.decals.push({ g, age: 0, ttl: d.ttlSec, baseAlpha: d.alpha });
  }

  private stepDecals(dt: number): void {
    const fadeSec = GORE_TUNING.decalFadeSec;
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const dc = this.decals[i]!;
      dc.age += dt;
      if (dc.age >= dc.ttl) {
        dc.g.destroy();
        this.decals.splice(i, 1);
        continue;
      }
      const fadeStart = dc.ttl - fadeSec;
      if (dc.age > fadeStart) dc.g.alpha = dc.baseAlpha * (1 - (dc.age - fadeStart) / fadeSec);
    }
  }
}
