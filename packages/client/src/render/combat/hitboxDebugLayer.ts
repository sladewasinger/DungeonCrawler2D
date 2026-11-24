/** Localhost-only collider, hurtbox, and directional attack hitbox debugger fed directly by engine geometry. */
import { getItemDef } from "@dc2d/content";
import {
  TILE_PX, WorldChunkCache, entityFootCollider, entityHurtbox, obstacleToColliderShape,
  playerFootCollider, playerHurtbox, resolveEntityAttackHitbox, resolvePlayerAttackHitbox,
  type AttackHitbox, type EllipseHurtbox, type GroundColliderShape,
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

interface StrokeSpec { readonly color: number; readonly width: number; readonly alpha: number; }
interface SectorStyle { readonly color: number; readonly width: number; readonly strokeAlpha: number; readonly fillAlpha: number; }

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

  private drawCapsuleCollider(o: { readonly cx: number; readonly cy: number; readonly shape: GroundColliderShape }, style: StrokeSpec): void {
    const a = o.shape.angleRad ?? 0;
    const ux = Math.cos(a) * o.shape.halfX * TILE_PX;
    const uy = Math.sin(a) * o.shape.halfX * TILE_PX;
    const r = o.shape.radius * TILE_PX;
    this.g
      .beginPath()
      .arc(o.cx + ux, o.cy + uy, r, a - Math.PI * 0.5, a + Math.PI * 0.5)
      .arc(o.cx - ux, o.cy - uy, r, a + Math.PI * 0.5, a + Math.PI * 1.5)
      .closePath()
      .stroke(style);
  }

  private drawGroundCollider(shape: GroundColliderShape, style: StrokeSpec): void {
    const cx = shape.x * TILE_PX;
    const cy = shape.y * TILE_PX - shape.elevation * ELEVATION_LIFT_PX;
    if (shape.halfX === 0 && shape.halfY === 0) { this.g.circle(cx, cy, shape.radius * TILE_PX).stroke(style); return; }
    if (shape.halfY === 0) { this.drawCapsuleCollider({ cx, cy, shape }, style); return; }
    const w = (shape.halfX + shape.radius) * 2 * TILE_PX;
    const h = (shape.halfY + shape.radius) * 2 * TILE_PX;
    this.g.roundRect(cx - w * 0.5, cy - h * 0.5, w, h, shape.radius * TILE_PX).stroke(style);
  }

  private drawHurtbox(box: EllipseHurtbox, elevation: number, style: StrokeSpec): void {
    const cy = box.cy * TILE_PX - elevation * ELEVATION_LIFT_PX;
    this.g.ellipse(box.cx * TILE_PX, cy, box.rx * TILE_PX, box.ry * TILE_PX).stroke(style);
  }

  private paintClosedShape(fillAlpha: number, style: StrokeSpec): void {
    if (fillAlpha > 0) this.g.fill({ color: style.color, alpha: fillAlpha });
    this.g.stroke(style);
  }

  private drawAttackHitbox(hitbox: AttackHitbox, opts: SectorStyle): void {
    const lift = hitbox.elevation * ELEVATION_LIFT_PX;
    const ax = hitbox.x * TILE_PX;
    const ay = hitbox.y * TILE_PX - lift;
    const ang = Math.atan2(hitbox.dirY, hitbox.dirX);
    this.g.beginPath().moveTo(ax, ay).arc(ax, ay, hitbox.range * TILE_PX, ang - hitbox.halfArcRad, ang + hitbox.halfArcRad).closePath();
    this.paintClosedShape(opts.fillAlpha, { color: opts.color, width: opts.width, alpha: opts.strokeAlpha });
    if (!hitbox.slamCenter || !hitbox.slamRadius) return;
    this.g.beginPath().circle(hitbox.slamCenter.x * TILE_PX, hitbox.slamCenter.y * TILE_PX - lift, hitbox.slamRadius * TILE_PX);
    this.paintClosedShape(opts.fillAlpha, { color: opts.color, width: opts.width, alpha: opts.strokeAlpha });
  }

  private drawPlayer(p: PlayerSnapshot): void {
    this.drawHurtbox(playerHurtbox(p), p.elevation, { color: 0x4ade80, width: 1.2, alpha: 0.85 });
    this.drawGroundCollider(playerFootCollider(p), { color: 0x86efac, width: 1, alpha: 0.78 });
    const atk = resolvePlayerAttackHitbox(p, getItemDef(p.heldItem ?? ""));
    if (!atk) return;
    this.drawAttackHitbox(atk.hitbox, atk.active
      ? { color: 0xfb923c, width: 1.5, strokeAlpha: 0.95, fillAlpha: 0.16 }
      : { color: 0xf59e0b, width: 1.0, strokeAlpha: 0.55, fillAlpha: 0 });
  }

  private drawEntity(e: WorldEntitySnapshot): void {
    this.drawHurtbox(entityHurtbox(e, e.kind), e.elevation, { color: 0x38bdf8, width: 1.3, alpha: 0.9 });
    this.drawGroundCollider(entityFootCollider(e, e.kind), { color: 0xfde047, width: 1, alpha: 0.75 });
    const atk = resolveEntityAttackHitbox(e);
    if (!atk) return;
    this.drawAttackHitbox(atk.hitbox, atk.phase === "active"
      ? { color: 0xef4444, width: 1.5, strokeAlpha: 0.95, fillAlpha: 0.22 }
      : { color: 0xf59e0b, width: 1.0, strokeAlpha: 0.55, fillAlpha: 0 });
  }

  private drawProjectile(pr: ProjectileSnapshot): void {
    const px = pr.x * TILE_PX;
    const py = pr.y * TILE_PX - (pr.elevation * ELEVATION_LIFT_PX + (pr.z ?? 0) * TILE_PX);
    this.g.circle(px, py, 2.5).stroke({ color: 0x38bdf8, width: 1.2, alpha: 0.95 });
    this.g.beginPath().moveTo(px, py).lineTo(px - pr.vx * 0.05 * TILE_PX, py - pr.vy * 0.05 * TILE_PX)
      .stroke({ color: 0x7dd3fc, width: 1.1, alpha: 0.8 });
  }

  private drawObstacles(cache: WorldChunkCache, local: PlayerSnapshot): void {
    for (const obs of cache.blockingObstaclesNear(local.x, local.y)) {
      if (Math.hypot(obs.x - local.x, obs.y - local.y) > 12) continue;
      this.drawGroundCollider(obstacleToColliderShape(obs), { color: 0xe2e8f0, width: 0.9, alpha: 0.35 });
    }
  }
}