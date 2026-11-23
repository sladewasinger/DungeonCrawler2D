/** Localhost-only hitbox, hurtbox ellipse, melee arc, projectile segment, and prop radius debugger. */
import {
  COMBAT_TUNING, TILE_PX, WorldChunkCache, playerProjectileHurtbox, projectileHurtbox,
  type PlayerSnapshot, type ProjectileSnapshot, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

export interface DebugHitboxInput {
  readonly cache: WorldChunkCache;
  readonly local: PlayerSnapshot | undefined;
  readonly players: readonly PlayerSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
}

export class HitboxDebugLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private enabled = false;

  constructor() {
    this.container.visible = false;
    this.container.addChild(this.g);
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
    this.container.visible = next;
    if (!next) this.g.clear();
  }

  render(input: DebugHitboxInput): void {
    if (!this.enabled) return;
    this.g.clear();
    if (input.local) this.drawObstacles(input.cache, input.local);
    this.drawActors(input.players, input.entities);
    for (const pr of input.projectiles) this.drawProjectile(pr);
  }

  private drawActors(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[]): void {
    for (const p of players) this.drawPlayer(p);
    for (const e of entities) if (!e.corpse && e.hp > 0) this.drawEntity(e);
  }

  private drawPlayer(p: PlayerSnapshot): void {
    const lift = p.elevation * ELEVATION_LIFT_PX;
    const hb = playerProjectileHurtbox(p);
    this.g.ellipse(hb.cx * TILE_PX, hb.cy * TILE_PX - lift, hb.rx * TILE_PX, hb.ry * TILE_PX)
      .stroke({ color: 0x4ade80, width: 1.2, alpha: 0.85 });
    const footR = COMBAT_TUNING.movement.collisionRadiusTiles * TILE_PX;
    this.g.circle(p.x * TILE_PX, p.y * TILE_PX - lift, footR).stroke({ color: 0x86efac, width: 1, alpha: 0.7 });
    if ((p.swingProgress ?? 0) > 0) this.drawSwingArc(p, lift);
  }

  private drawSwingArc(p: PlayerSnapshot, lift: number): void {
    const ang = Math.atan2(p.aimY ?? p.facingY, p.aimX ?? p.facingX);
    const r = 1.65 * TILE_PX;
    const half = 0.8;
    this.g.moveTo(p.x * TILE_PX, p.y * TILE_PX - lift)
      .arc(p.x * TILE_PX, p.y * TILE_PX - lift, r, ang - half, ang + half)
      .closePath()
      .stroke({ color: 0xfb923c, width: 1.5, alpha: 0.9 });
  }

  private drawEntity(e: WorldEntitySnapshot): void {
    const lift = e.elevation * ELEVATION_LIFT_PX;
    const hb = projectileHurtbox(e, e.kind);
    this.g.ellipse(hb.cx * TILE_PX, hb.cy * TILE_PX - lift, hb.rx * TILE_PX, hb.ry * TILE_PX)
      .stroke({ color: 0xf87171, width: 1.3, alpha: 0.9 });
    this.g.circle(e.x * TILE_PX, e.y * TILE_PX - lift, 4.5).stroke({ color: 0xfde047, width: 1, alpha: 0.75 });
  }

  private drawProjectile(pr: ProjectileSnapshot): void {
    const lift = pr.elevation * ELEVATION_LIFT_PX;
    const px = pr.x * TILE_PX;
    const py = pr.y * TILE_PX - lift;
    this.g.circle(px, py, 2.5).stroke({ color: 0x38bdf8, width: 1.2, alpha: 0.95 });
    this.g.moveTo(px, py).lineTo(px - pr.vx * 0.05 * TILE_PX, py - pr.vy * 0.05 * TILE_PX)
      .stroke({ color: 0x7dd3fc, width: 1.1, alpha: 0.8 });
  }

  private drawObstacles(cache: WorldChunkCache, local: PlayerSnapshot): void {
    for (const obs of cache.blockingObstaclesNear(local.x, local.y)) {
      if (Math.hypot(obs.x - local.x, obs.y - local.y) > 12) continue;
      this.g.circle(obs.x * TILE_PX, obs.y * TILE_PX, obs.radius * TILE_PX)
        .stroke({ color: 0xe2e8f0, width: 0.9, alpha: 0.35 });
    }
  }
}