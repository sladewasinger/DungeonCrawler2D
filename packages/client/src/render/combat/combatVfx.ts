/** Renders weapon-specific slash arcs, thrusts, slam impacts, arrows, bow gauges, parry bursts, and popups. */
import {
  GroundKind, TILE_PX, resolveWeaponArchetype, type AttackMotionKind, type PlayerSnapshot, type ProjectileSnapshot,
  type WeaponArchetype, type WorldEvent,
} from "@dc2d/engine";
import { Container, Graphics, Text } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { MELEE_SWING_TUNING, type SmearSpec } from "./combatVisualTuning.js";
import { drawWeaponSmear, resolveWeaponSmearSpec } from "./weapons/weaponSmearDraw.js";

type SlashSpec = SmearSpec;

interface SlashEffect {
  readonly g: Graphics;
  age: number;
  ttl: number;
  readonly baseAngle: number;
  readonly spec: SlashSpec | null;
  readonly actorId: string | undefined;
  readonly motion: AttackMotionKind;
  readonly archetype: WeaponArchetype;
}

interface FloatingPopup {
  readonly text: Text;
  age: number;
  ttl: number;
  vy: number;
}

function drawArrowGraphic(g: Graphics, charge: number): void {
  g.clear();
  if (charge >= 0.7) g.moveTo(-11, 0).lineTo(-5, 0).stroke({ color: 0xfef08a, width: 1.1, alpha: 0.7 });
  g.rect(-5, -0.7, 9, 1.4).fill(0xa16207);
  g.rect(4, -1.3, 2.5, 2.6).fill(0xe2e8f0);
  g.rect(-6, -1.6, 2, 3.2).fill(0xf8fafc);
}

function drawPebbleGraphic(g: Graphics, zPx: number): void {
  g.clear();
  g.ellipse(0, zPx, 2.6, 1.2).fill({ color: 0x090d14, alpha: 0.35 });
  g.circle(0, 0, 2.3).fill(0x0f172a);
  g.circle(0, 0, 1.6).fill(0x94a3b8);
}

function drawBurst(opts: { readonly g: Graphics; readonly color: number; readonly radius: number; readonly rays: number }): void {
  for (let i = 0; i < opts.rays; i++) {
    const a = (i / opts.rays) * Math.PI * 2;
    opts.g.moveTo(Math.cos(a) * 2, Math.sin(a) * 2).lineTo(Math.cos(a) * opts.radius, Math.sin(a) * opts.radius);
  }
  opts.g.stroke({ color: opts.color, width: 1.5, alpha: 0.95 });
}

export class CombatVfxLayer {
  readonly container = new Container();
  private readonly slashes: SlashEffect[] = [];
  private readonly popups: FloatingPopup[] = [];
  private readonly arrows = new Map<string, Graphics>();
  private readonly chargeBar = new Graphics();
  private hitstopTimer = 0;

  constructor() {
    this.chargeBar.visible = false;
    this.container.addChild(this.chargeBar);
  }

  consumeHitstop(dt: number): boolean {
    if (this.hitstopTimer <= 0) return false;
    this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    return true;
  }

  handleEvents(events: readonly WorldEvent[], localId: string, players: readonly PlayerSnapshot[] = []): void {
    for (const ev of events) this.handleSingleEvent(ev, localId, players);
  }

  private handleSingleEvent(ev: WorldEvent, localId: string, players: readonly PlayerSnapshot[]): void {
    if (ev.kind === "swing") return this.spawnSlash(ev, players);
    if (ev.kind === "hit") return this.handleHitEvent(ev, localId);
    if (ev.kind === "parry") return this.handleParryEvent(ev, localId);
    this.handleFeedbackEvent(ev);
  }

  private handleFeedbackEvent(ev: WorldEvent): void {
    const bursts: Partial<Record<WorldEvent["kind"], () => void>> = {
      block: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0x93c5fd, radius: 9, text: "BLOCK" }),
      heal: () => this.spawnPopup({ x: ev.x, y: ev.y - 0.9, label: `+${Math.round(ev.value ?? 20)}`, color: 0x4ade80 }),
      dodge: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0xcbd5e1, radius: 7, text: "" }),
      arrowRicochet: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0xfde047, radius: 7, text: "" }),
      arrowEmbed: () => this.spawnStuckArrow(ev),
      distract: () => this.spawnNoiseRipple(ev),
      pebbleLand: () => this.spawnRingPulse({ x: ev.x, y: ev.y, color: ev.value === GroundKind.ShallowWater || ev.value === GroundKind.DeepWater ? 0x38bdf8 : 0xd6d3d1, radius: 11, text: "" }),
      wolfHowl: () => this.spawnRingPulse({ x: ev.x, y: ev.y, color: 0x7dd3fc, radius: 18, text: "" }),
      bearBluff: () => this.spawnRingPulse({ x: ev.x, y: ev.y, color: 0xf97316, radius: 17, text: "ROAR!" }),
      boarCrash: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0xfde047, radius: 14, text: "CRASH!" }),
      ambushShot: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0xfde047, radius: 13, text: "AMBUSH!" }),
      backstab: () => this.spawnBurst({ x: ev.x, y: ev.y, color: 0xfacc15, radius: 13, text: "BACKSTAB!" }),
      bedSet: () => this.spawnPopup({ x: ev.x, y: ev.y - 1.1, label: "RESPAWN SET!", color: 0x4ade80 }),
    };
    bursts[ev.kind]?.();
  }

  private spawnRingPulse(opts: { readonly x: number; readonly y: number; readonly color: number; readonly radius: number; readonly text: string }): void {
    const g = new Graphics();
    g.circle(0, 0, opts.radius * 0.55).stroke({ color: opts.color, width: 1.4, alpha: 0.82 });
    g.circle(0, 0, opts.radius).stroke({ color: opts.color, width: 1.0, alpha: 0.48 });
    g.position.set(opts.x * TILE_PX, opts.y * TILE_PX - 4);
    this.container.addChild(g);
    this.slashes.push({ g, age: 0, ttl: 0.55, baseAngle: 0, spec: null, actorId: undefined, motion: "slash", archetype: "sword" });
    if (opts.text) this.spawnPopup({ x: opts.x, y: opts.y - 1.15, label: opts.text, color: opts.color });
  }

  private spawnNoiseRipple(ev: WorldEvent): void {
    const g = new Graphics();
    g.circle(0, 0, 6).stroke({ color: 0xfde047, width: 1.2, alpha: 0.75 });
    g.circle(0, 0, 12).stroke({ color: 0xfde047, width: 0.9, alpha: 0.45 });
    g.position.set(ev.x * TILE_PX, ev.y * TILE_PX - 2);
    this.container.addChild(g);
    this.slashes.push({ g, age: 0, ttl: 0.65, baseAngle: 0, spec: null, actorId: undefined, motion: "slash", archetype: "sword" });
  }

  private spawnStuckArrow(ev: WorldEvent): void {
    const g = new Graphics();
    drawArrowGraphic(g, 0.4);
    g.position.set(ev.x * TILE_PX, ev.y * TILE_PX - 8);
    g.rotation = Math.atan2(ev.dirY ?? 0, ev.dirX ?? 1);
    this.container.addChild(g);
    this.slashes.push({ g, age: 0, ttl: 3.5, baseAngle: 0, spec: null, actorId: undefined, motion: "slash", archetype: "sword" });
  }

  step(input: {
    readonly dt: number;
    readonly projectiles: readonly ProjectileSnapshot[];
    readonly players: readonly PlayerSnapshot[];
    readonly local: PlayerSnapshot | undefined;
  }): void {
    this.stepSlashes(input.dt, input.players);
    this.stepPopups(input.dt);
    this.syncProjectiles(input.projectiles);
    this.syncBowChargeBar(input.local);
  }

  private handleHitEvent(ev: WorldEvent, localId: string): void {
    const val = Math.round(ev.value ?? 0);
    const hurtLocal = ev.targetId === localId;
    if (val > 0) {
      this.spawnPopup({ x: ev.x, y: ev.y - 0.85, label: ev.fatal ? `-${val}!` : `-${val}`, color: hitPopupColor(ev.fatal, hurtLocal) });
    }
    if (ev.actorId === localId || hurtLocal) this.hitstopTimer = MELEE_SWING_TUNING.hitstopHitSec;
  }

  private handleParryEvent(ev: WorldEvent, localId: string): void {
    this.spawnBurst({ x: ev.x, y: ev.y, color: 0xfacc15, radius: 13, text: "PARRY!" });
    if (ev.actorId === localId || ev.targetId === localId) this.hitstopTimer = MELEE_SWING_TUNING.hitstopParrySec;
  }

  private spawnSlash(ev: WorldEvent, players: readonly PlayerSnapshot[]): void {
    const g = new Graphics();
    const baseAngle = Math.atan2(ev.dirY ?? 1, ev.dirX ?? 0);
    const actor = ev.actorId ? players.find((p) => p.id === ev.actorId) : undefined;
    const archetype = ev.weaponArchetype ?? resolveWeaponArchetype(actor?.heldItem);
    const { smear, motion, ttl } = resolveWeaponSmearSpec(archetype, ev.comboStep ?? 1);
    g.position.set(ev.x * TILE_PX, ev.y * TILE_PX - 10);
    this.container.addChild(g);
    const effect: SlashEffect = { g, age: 0, ttl, baseAngle, spec: smear, actorId: ev.actorId, motion, archetype };
    drawWeaponSmear({ g, u: 0.08, baseAngle, spec: smear, motion, archetype });
    this.slashes.push(effect);
  }

  private spawnBurst(opts: { readonly x: number; readonly y: number; readonly color: number; readonly radius: number; readonly text: string }): void {
    const g = new Graphics();
    drawBurst({ g, color: opts.color, radius: opts.radius, rays: 8 });
    g.position.set(opts.x * TILE_PX, opts.y * TILE_PX - 10);
    this.container.addChild(g);
    this.slashes.push({ g, age: 0, ttl: 0.22, baseAngle: 0, spec: null, actorId: undefined, motion: "slash", archetype: "sword" });
    if (opts.text) this.spawnPopup({ x: opts.x, y: opts.y - 1.1, label: opts.text, color: opts.color });
  }

  private spawnPopup(opts: { readonly x: number; readonly y: number; readonly label: string; readonly color: number }): void {
    const text = new Text({
      text: opts.label, resolution: 2,
      style: {
        fontSize: 28, fontWeight: "800", fill: opts.color,
        fontFamily: "system-ui, -apple-system, sans-serif",
        stroke: { color: 0x090d14, width: 6, join: "round" },
      },
    });
    text.anchor.set(0.5, 0.5);
    text.scale.set(0.24);
    text.position.set(opts.x * TILE_PX, opts.y * TILE_PX);
    this.container.addChild(text);
    this.popups.push({ text, age: 0, ttl: 0.65, vy: -18 });
  }

  private stepSlashes(dt: number, players: readonly PlayerSnapshot[]): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i]!;
      s.age += dt;
      if (s.age >= s.ttl) { s.g.destroy(); this.slashes.splice(i, 1); continue; }
      const actor = s.actorId ? players.find((p) => p.id === s.actorId) : undefined;
      if (actor) s.g.position.set(actor.x * TILE_PX, actor.y * TILE_PX - actor.elevation * ELEVATION_LIFT_PX - 10);
      drawWeaponSmear({ g: s.g, u: s.age / s.ttl, baseAngle: s.baseAngle, spec: s.spec, motion: s.motion, archetype: s.archetype });
    }
  }

  private stepPopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.age += dt;
      if (p.age >= p.ttl) { p.text.destroy(); this.popups.splice(i, 1); continue; }
      p.text.position.y += p.vy * dt;
      p.text.alpha = Math.min(1, (1 - p.age / p.ttl) * 1.4);
    }
  }

  private syncSingleProjectile(p: ProjectileSnapshot): void {
    let g = this.arrows.get(p.id);
    if (!g) {
      g = new Graphics();
      if (p.kind !== "pebble") drawArrowGraphic(g, p.charge);
      this.arrows.set(p.id, g);
      this.container.addChild(g);
    }
    const zPx = (p.z ?? 0) * TILE_PX;
    if (p.kind === "pebble") drawPebbleGraphic(g, zPx);
    g.position.set(p.x * TILE_PX, p.y * TILE_PX - (p.elevation * ELEVATION_LIFT_PX + 10 + zPx));
    g.rotation = p.kind === "pebble" ? 0 : Math.atan2(p.vy, p.vx);
  }

  private syncProjectiles(projectiles: readonly ProjectileSnapshot[]): void {
    const live = new Set(projectiles.map((p) => p.id));
    for (const [id, g] of this.arrows) {
      if (!live.has(id)) { g.destroy(); this.arrows.delete(id); }
    }
    for (const p of projectiles) this.syncSingleProjectile(p);
  }

  private syncBowChargeBar(local: PlayerSnapshot | undefined): void {
    const charge = local?.bowCharge ?? 0;
    if (!local || charge <= 0.02) { this.chargeBar.visible = false; return; }
    this.chargeBar.clear();
    this.chargeBar.rect(-9, 0, 18, 3).fill({ color: 0x090d14, alpha: 0.85 });
    const full = charge >= 0.92;
    this.chargeBar.rect(-8, 0.7, Math.max(1, Math.round(16 * charge)), 1.6).fill(full ? 0x4ade80 : 0xfacc15);
    const lift = local.elevation * ELEVATION_LIFT_PX;
    this.chargeBar.position.set(local.x * TILE_PX, local.y * TILE_PX - lift - 41);
    this.chargeBar.visible = true;
  }
}

function hitPopupColor(fatal: boolean | undefined, hurtLocal: boolean): number {
  if (hurtLocal) return fatal ? 0xff1f1f : 0xff3b3b;
  return fatal ? 0xfacc15 : 0xf87171;
}
