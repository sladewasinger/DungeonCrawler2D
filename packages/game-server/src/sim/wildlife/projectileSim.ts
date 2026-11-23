/** Authoritative arrow projectile simulation and collision against dummies, wildlife, and players. */
import { PARRY_STAGGER_SEC, WorldChunkCache, isInSanctuary, type GoreStyle, type ProjectileSnapshot, type WorldEvent } from "@dc2d/engine";
import { applyIncomingPlayerHit, type CombatPlayerRef } from "../combatActions.js";
import { damageDummy, type SimEntity } from "../dummySim.js";
import type { WorldEcology } from "./worldEcology.js";

export interface SimProjectile {
  readonly id: string;
  readonly ownerId: string;
  readonly originX: number;
  readonly originY: number;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly elevation: number;
  readonly charge: number;
  readonly damage: number;
  ttl: number;
}

const DRIP_GORE: GoreStyle = "drip";

interface RayHitCtx {
  readonly pr: SimProjectile;
  readonly dx: number;
  readonly dy: number;
  readonly events: WorldEvent[];
}

function hitDummy(ctx: RayHitCtx, dummies: readonly SimEntity[]): boolean {
  for (const d of dummies) {
    if (d.respawnTimer > 0 || Math.hypot(ctx.pr.x - d.x, ctx.pr.y - d.y) > 0.48) continue;
    return damageDummy({ entity: d, damage: ctx.pr.damage, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
  }
  return false;
}

function hitWildlife(ctx: RayHitCtx, ecology: WorldEcology): boolean {
  for (const w of ecology.list) {
    if (w.corpse || w.hp <= 0 || Math.hypot(ctx.pr.x - w.x, ctx.pr.y - w.y) > 0.48) continue;
    return ecology.damageEntity({ entity: w, damage: ctx.pr.damage, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
  }
  return false;
}

function hitPlayer(ctx: RayHitCtx, players: Map<string, CombatPlayerRef>): boolean {
  for (const p of players.values()) {
    if (p.id === ctx.pr.ownerId || Math.hypot(ctx.pr.x - p.x, ctx.pr.y - p.y) > 0.42) continue;
    if (isInSanctuary(ctx.pr.originX, ctx.pr.originY) || isInSanctuary(p.x, p.y)) return true;
    applyIncomingPlayerHit({
      target: p, attackerOrigin: { x: ctx.pr.originX, y: ctx.pr.originY }, attackerId: ctx.pr.ownerId,
      rawDamage: ctx.pr.damage, goreStyle: DRIP_GORE, attackerIsPlayer: true, events: ctx.events,
      onParry: () => { const owner = players.get(ctx.pr.ownerId); if (owner) owner.combat.staggerTimer = PARRY_STAGGER_SEC; },
    });
    return true;
  }
  return false;
}

function hitProjectileTarget(opts: {
  readonly pr: SimProjectile; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[];
}): boolean {
  const spd = Math.max(0.01, Math.hypot(opts.pr.vx, opts.pr.vy));
  const ctx: RayHitCtx = { pr: opts.pr, dx: opts.pr.vx / spd, dy: opts.pr.vy / spd, events: opts.events };
  return hitDummy(ctx, opts.dummies) || hitWildlife(ctx, opts.ecology) || hitPlayer(ctx, opts.players);
}

export function stepProjectileList(opts: {
  readonly cache: WorldChunkCache; readonly projectiles: SimProjectile[]; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[]; readonly dt: number;
}): void {
  const { cache, projectiles, dummies, ecology, players, events, dt } = opts;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i]!;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.ttl -= dt;
    const blocked = cache.tileAt(Math.floor(pr.x), Math.floor(pr.y)).elevation > pr.elevation;
    if (blocked || pr.ttl <= 0 || hitProjectileTarget({ pr, dummies, ecology, players, events })) {
      projectiles.splice(i, 1);
    }
  }
}

export function serializeProjectiles(projectiles: readonly SimProjectile[]): ProjectileSnapshot[] {
  return projectiles.map((pr) => ({
    id: pr.id, ownerId: pr.ownerId, kind: "arrow",
    x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, elevation: pr.elevation, charge: pr.charge, element: "none",
  }));
}
