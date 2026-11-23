/** Authoritative swept-segment arrow projectile simulation, tree embedding, stone ricochet, and arrow recovery. */
import {
  GroundKind, PARRY_STAGGER_SEC, PropKind, WorldChunkCache, isInSanctuary,
  playerProjectileHurtbox, projectileHurtbox, segmentHitsEllipse,
  type ChunkProp, type GoreStyle, type ProjectileSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { applyIncomingPlayerHit, type CombatPlayerRef } from "../combatActions.js";
import { damageDummy, type SimEntity } from "../dummySim.js";
import { CREATURE_SPECS, type WildlifeEntity } from "./creatureSpecs.js";
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
const WOOD_PROPS = new Set<PropKind>([PropKind.OakTree, PropKind.PineTree, PropKind.Palisade, PropKind.Stump]);
const STONE_PROPS = new Set<PropKind>([PropKind.Boulder, PropKind.RuinPillar]);

interface RayHitCtx {
  readonly pr: SimProjectile;
  readonly x0: number;
  readonly y0: number;
  readonly dx: number;
  readonly dy: number;
  readonly events: WorldEvent[];
}

function hitDummy(ctx: RayHitCtx, dummies: readonly SimEntity[], ecology: WorldEcology): boolean {
  for (const d of dummies) {
    if (d.respawnTimer > 0) continue;
    const t = segmentHitsEllipse({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, box: projectileHurtbox(d, d.kind) });
    if (t === null) continue;
    damageDummy({ entity: d, damage: ctx.pr.damage, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
    ecology.spawnRecoverableArrow(d.x - ctx.dx * 0.35, d.y - ctx.dy * 0.35);
    return true;
  }
  return false;
}

function applyWildlifeArrowHit(opts: { readonly ctx: RayHitCtx; readonly w: WildlifeEntity; readonly t: number; readonly ecology: WorldEcology }): void {
  const { ctx, w, t, ecology } = opts;
  const isStone = CREATURE_SPECS[w.kind].substance === "stone";
  if (!isStone) w.embeddedArrows += 1;
  ecology.damageEntity({ entity: w, damage: ctx.pr.damage, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
  if (!isStone) return;
  const hx = ctx.x0 + (ctx.pr.x - ctx.x0) * t;
  const hy = ctx.y0 + (ctx.pr.y - ctx.y0) * t;
  ctx.events.push({ kind: "arrowRicochet", x: hx, y: hy, dirX: -ctx.dx, dirY: -ctx.dy });
}

function hitWildlife(ctx: RayHitCtx, ecology: WorldEcology): boolean {
  for (const w of ecology.list) {
    if (w.corpse || w.hp <= 0) continue;
    const t = segmentHitsEllipse({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, box: projectileHurtbox(w, w.kind) });
    if (t === null) continue;
    applyWildlifeArrowHit({ ctx, w, t, ecology });
    return true;
  }
  return false;
}

function hitPlayer(ctx: RayHitCtx, players: Map<string, CombatPlayerRef>): boolean {
  for (const p of players.values()) {
    if (p.id === ctx.pr.ownerId) continue;
    if (segmentHitsEllipse({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, box: playerProjectileHurtbox(p) }) === null) continue;
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

function testPropImpact(ctx: RayHitCtx, prop: ChunkProp, ecology: WorldEcology): boolean {
  const isWood = WOOD_PROPS.has(prop.kind);
  const isStone = STONE_PROPS.has(prop.kind);
  if ((!isWood && !isStone) || prop.elevation > ctx.pr.elevation) return false;
  const t = segmentHitsEllipse({
    x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y,
    box: { cx: prop.x, cy: prop.y - 0.15, rx: prop.radius + 0.14, ry: prop.radius + 0.42 },
  });
  if (t === null) return false;
  const hx = ctx.x0 + (ctx.pr.x - ctx.x0) * t;
  const hy = ctx.y0 + (ctx.pr.y - ctx.y0) * t;
  if (isWood) {
    ctx.events.push({ kind: "arrowEmbed", x: hx, y: hy, dirX: ctx.dx, dirY: ctx.dy });
    ecology.spawnRecoverableArrow(hx - ctx.dx * 0.4, hy - ctx.dy * 0.4);
  } else {
    ctx.events.push({ kind: "arrowRicochet", x: hx, y: hy, dirX: -ctx.dx, dirY: -ctx.dy });
  }
  return true;
}

function checkPropCollision(ctx: RayHitCtx, cache: WorldChunkCache, ecology: WorldEcology): boolean {
  return cache.propsNear(ctx.pr.x, ctx.pr.y).some((prop) => testPropImpact(ctx, prop, ecology));
}

function stepSingleProjectile(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[]; readonly dt: number;
}): boolean {
  const { pr, cache, dummies, ecology, players, events, dt } = opts;
  const x0 = pr.x;
  const y0 = pr.y;
  pr.x += pr.vx * dt;
  pr.y += pr.vy * dt;
  pr.ttl -= dt;
  const spd = Math.max(0.01, Math.hypot(pr.vx, pr.vy));
  const ctx: RayHitCtx = { pr, x0, y0, dx: pr.vx / spd, dy: pr.vy / spd, events };
  if (hitDummy(ctx, dummies, ecology) || hitWildlife(ctx, ecology) || hitPlayer(ctx, players)) return false;
  if (checkPropCollision(ctx, cache, ecology)) return false;
  const tile = cache.tileAt(Math.floor(pr.x), Math.floor(pr.y));
  if (tile.elevation > pr.elevation) { events.push({ kind: "arrowRicochet", x: x0, y: y0, dirX: -ctx.dx, dirY: -ctx.dy }); return false; }
  if (pr.ttl <= 0) {
    if (tile.ground !== GroundKind.DeepWater) {
      events.push({ kind: "arrowEmbed", x: pr.x, y: pr.y, dirX: ctx.dx, dirY: ctx.dy });
      ecology.spawnRecoverableArrow(pr.x, pr.y);
    }
    return false;
  }
  return true;
}

export function stepProjectileList(opts: {
  readonly cache: WorldChunkCache; readonly projectiles: SimProjectile[]; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[]; readonly dt: number;
}): void {
  for (let i = opts.projectiles.length - 1; i >= 0; i--) {
    if (!stepSingleProjectile({ ...opts, pr: opts.projectiles[i]! })) opts.projectiles.splice(i, 1);
  }
}

export function serializeProjectiles(projectiles: readonly SimProjectile[]): ProjectileSnapshot[] {
  return projectiles.map((pr) => ({
    id: pr.id, ownerId: pr.ownerId, kind: "arrow",
    x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, elevation: pr.elevation, charge: pr.charge, element: "none",
  }));
}