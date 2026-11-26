/** Authoritative swept-segment arrow and arcing pebble simulation, trunk embedding, and recovery. */
import {
  GroundKind, PARRY_STAGGER_SEC, PropKind, STEALTH_TUNING, WorldChunkCache, isInWorldSanctuary,
  playerProjectileHurtbox, projectileHitsHurtbox, projectileHurtbox, segmentHitsEllipse,
  type ChunkProp, type GoreStyle, type ProjectileSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { applyIncomingPlayerHit, type CombatPlayerRef } from "../combatActions.js";
import { applyPerkEffectsToTarget } from "../combat/gearEffects.js";
import { damageDummy, type SimEntity } from "../dummySim.js";
import { createWebProjectile, stepWebProjectile } from "../webs/webCocoon.js";
import type { WorldWebNetwork } from "../webs/webNetwork.js";
import { CREATURE_SPECS, type WildlifeEntity } from "./creatureSpecs.js";
import { UNAWARE_STATES } from "./ecologyHelpers.js";
import type { WorldEcology } from "./worldEcology.js";

export { createWebProjectile };

export type ProjectileElement = "none" | "fire" | "poison";

export interface SimProjectile {
  readonly id: string; readonly ownerId: string; readonly kind: "arrow" | "pebble" | "web";
  readonly originX: number; readonly originY: number; x: number; y: number; z: number;
  readonly vx: number; readonly vy: number; vz: number; readonly elevation: number;
  readonly charge: number; readonly damage: number; readonly noiseRadius?: number | undefined;
  readonly element?: ProjectileElement | undefined; readonly lifestealRatio?: number | undefined;
  readonly burnDamage?: number | undefined; readonly poisonDamage?: number | undefined; readonly bleedDamage?: number | undefined;
  ttl: number;
}

const DRIP_GORE: GoreStyle = "drip";
const WOOD_PROPS = new Set<PropKind>([
  PropKind.OakTree, PropKind.PineTree, PropKind.BirchTree, PropKind.MapleTree, PropKind.DeadTree,
  PropKind.GreatStump, PropKind.Palisade, PropKind.HermitHut, PropKind.BrokenCart, PropKind.SunkenBoat, PropKind.BoneTotem,
]);
const TREE_TRUNK_PROPS = new Set<PropKind>([PropKind.OakTree, PropKind.PineTree, PropKind.BirchTree, PropKind.MapleTree, PropKind.DeadTree]);
const STONE_PROPS = new Set<PropKind>([
  PropKind.RuinPillar, PropKind.Boulder, PropKind.CopperVein, PropKind.IronVein,
  PropKind.CursedCrystal, PropKind.CursedObelisk, PropKind.RunicForge,
]);
const PEBBLE_GRAVITY = 22;
const PEBBLE_FLIGHT_SEC = 0.48;
const PEBBLE_Z0 = 0.55;

interface RayHitCtx {
  readonly cache: WorldChunkCache; readonly pr: SimProjectile; readonly x0: number; readonly y0: number;
  readonly dx: number; readonly dy: number; readonly onStairs: boolean; readonly events: WorldEvent[];
}

export function createArrowProjectile(opts: {
  readonly id: string; readonly p: CombatPlayerRef; readonly speed: number; readonly charge: number; readonly damage: number;
  readonly perks?: { readonly element?: ProjectileElement; readonly lifestealRatio?: number; readonly burnDamage?: number; readonly poisonDamage?: number; readonly bleedDamage?: number };
}): SimProjectile {
  const { p } = opts;
  return {
    id: opts.id, ownerId: p.id, kind: "arrow", originX: p.x, originY: p.y,
    x: p.x + p.aimX * 0.45, y: p.y + p.aimY * 0.45, z: 0.45,
    vx: p.aimX * opts.speed, vy: p.aimY * opts.speed, vz: 0,
    elevation: p.elevation, charge: opts.charge, damage: opts.damage, ttl: 0.95, ...opts.perks,
  };
}

export function createPebbleProjectile(opts: {
  readonly id: string; readonly p: CombatPlayerRef; readonly cache: WorldChunkCache; readonly consumeStone: boolean;
}): SimProjectile {
  const { p, cache, consumeStone } = opts;
  const maxDist: number = consumeStone ? STEALTH_TUNING.stoneThrowRangeTiles : STEALTH_TUNING.pebbleRangeTiles;
  const mag = Math.max(0.01, Math.hypot(p.aimX, p.aimY));
  const nx = p.aimX / mag;
  const ny = p.aimY / mag;
  let dist = maxDist;
  for (let i = 1; i <= 10; i++) {
    const r = (maxDist * i) / 10;
    if (cache.tileAt(Math.floor(p.x + nx * r), Math.floor(p.y + ny * r)).elevation > p.elevation) break;
    dist = r;
  }
  const vz = PEBBLE_GRAVITY * 0.5 * PEBBLE_FLIGHT_SEC - PEBBLE_Z0 / PEBBLE_FLIGHT_SEC;
  return {
    id: opts.id, ownerId: p.id, kind: "pebble", originX: p.x, originY: p.y,
    x: p.x + nx * 0.25, y: p.y + ny * 0.25, z: PEBBLE_Z0,
    vx: (nx * (dist - 0.25)) / PEBBLE_FLIGHT_SEC, vy: (ny * (dist - 0.25)) / PEBBLE_FLIGHT_SEC, vz,
    elevation: p.elevation, charge: 1, damage: consumeStone ? STEALTH_TUNING.stoneThrowDamage : 0,
    noiseRadius: consumeStone ? STEALTH_TUNING.stoneThrowNoiseRadiusTiles : STEALTH_TUNING.pebbleNoiseRadiusTiles,
    ttl: PEBBLE_FLIGHT_SEC,
  };
}

function hitDummy(ctx: RayHitCtx, dummies: readonly SimEntity[], ecology: WorldEcology): boolean {
  for (const d of dummies) {
    if (d.respawnTimer > 0) continue;
    const t = projectileHitsHurtbox({
      x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y,
      projectileElevation: ctx.pr.elevation, projectileOnStairs: ctx.onStairs,
      box: projectileHurtbox(d, d.kind, ctx.cache),
    });
    if (t === null) continue;
    damageDummy({ entity: d, damage: ctx.pr.damage, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
    ecology.spawnRecoverableArrow({ x: d.x - ctx.dx * 0.35, y: d.y - ctx.dy * 0.35, angle: Math.atan2(ctx.dy, ctx.dx), stuck: true });
    return true;
  }
  return false;
}

function hasArrowPerk(pr: SimProjectile): boolean {
  return Boolean(pr.lifestealRatio || pr.burnDamage || pr.poisonDamage || pr.bleedDamage);
}

const orZero = (v: number | undefined): number => v ?? 0;

function applyArrowPerksOnWildlife(opts: { readonly ctx: RayHitCtx; readonly w: WildlifeEntity; readonly dmg: number; readonly players?: Map<string, CombatPlayerRef> | undefined }): void {
  const { ctx, w, dmg, players } = opts;
  if (!hasArrowPerk(ctx.pr)) return;
  const owner = players?.get(ctx.pr.ownerId);
  const attackerPos = owner ?? { x: ctx.pr.originX, y: ctx.pr.originY };
  const attackerCombat = (owner?.combat ?? { hp: 0, maxHp: 100 }) as CombatPlayerRef["combat"];
  const perks = {
    lifestealRatio: orZero(ctx.pr.lifestealRatio), burnDamage: orZero(ctx.pr.burnDamage),
    poisonDamage: orZero(ctx.pr.poisonDamage), bleedDamage: orZero(ctx.pr.bleedDamage),
  };
  applyPerkEffectsToTarget({ attackerId: ctx.pr.ownerId, attackerPos, attackerCombat, perks, target: w, damageDealt: dmg, events: ctx.events });
}

function applyWildlifeArrowHit(opts: { readonly ctx: RayHitCtx; readonly w: WildlifeEntity; readonly t: number; readonly ecology: WorldEcology; readonly players?: Map<string, CombatPlayerRef> }): void {
  const { ctx, w, t, ecology, players } = opts;
  const isStone = CREATURE_SPECS[w.kind].substance === "stone";
  const unaware = UNAWARE_STATES.has(w.aiState) && w.targetPlayerId === null;
  const dmg = unaware ? Math.round(ctx.pr.damage * STEALTH_TUNING.ambushBowDamageMult) : ctx.pr.damage;
  if (!isStone) w.embeddedArrows += 1;
  if (unaware) ctx.events.push({ kind: "ambushShot", x: w.x, y: w.y, value: dmg, actorId: ctx.pr.ownerId, targetId: w.id });
  ecology.damageEntity({ entity: w, damage: dmg, dirX: ctx.dx, dirY: ctx.dy, goreStyle: DRIP_GORE, actorId: ctx.pr.ownerId, events: ctx.events });
  applyArrowPerksOnWildlife({ ctx, w, dmg, players });
  if (!isStone) return;
  ctx.events.push({ kind: "arrowRicochet", x: ctx.x0 + (ctx.pr.x - ctx.x0) * t, y: ctx.y0 + (ctx.pr.y - ctx.y0) * t, dirX: -ctx.dx, dirY: -ctx.dy });
}

function hitWildlife(ctx: RayHitCtx, ecology: WorldEcology, players: Map<string, CombatPlayerRef>): boolean {
  for (const w of ecology.list) {
    if (w.corpse || w.hp <= 0) continue;
    const t = projectileHitsHurtbox({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, projectileElevation: ctx.pr.elevation, projectileOnStairs: ctx.onStairs, box: projectileHurtbox(w, w.kind, ctx.cache) });
    if (t === null) continue;
    applyWildlifeArrowHit({ ctx, w, t, ecology, players }); return true;
  }
  return false;
}

function hitPlayer(ctx: RayHitCtx, players: Map<string, CombatPlayerRef>): boolean {
  for (const p of players.values()) {
    if (p.id === ctx.pr.ownerId) continue;
    const hitT = projectileHitsHurtbox({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, projectileElevation: ctx.pr.elevation, projectileOnStairs: ctx.onStairs, box: playerProjectileHurtbox(p, ctx.cache) });
    if (hitT === null) continue;
    if (isInWorldSanctuary(ctx.cache, ctx.pr.originX, ctx.pr.originY) || isInWorldSanctuary(ctx.cache, p.x, p.y)) return true;
    applyIncomingPlayerHit({
      cache: ctx.cache, target: p, attackerOrigin: { x: ctx.pr.originX, y: ctx.pr.originY }, attackerId: ctx.pr.ownerId,
      rawDamage: ctx.pr.damage, goreStyle: DRIP_GORE, attackerIsPlayer: true,
      ignites: (ctx.pr.burnDamage ?? 0) > 0, appliesPoison: (ctx.pr.poisonDamage ?? 0) > 0, events: ctx.events,
      onParry: () => { const owner = players.get(ctx.pr.ownerId); if (owner) owner.combat.staggerTimer = PARRY_STAGGER_SEC; },
    });
    return true;
  }
  return false;
}

function propImpactBox(prop: ChunkProp) {
  if (TREE_TRUNK_PROPS.has(prop.kind)) return { cx: prop.x, cy: prop.y, rx: 0.24, ry: 0.18 };
  return { cx: prop.x, cy: prop.y - 0.15, rx: prop.radius + 0.12, ry: prop.radius + 0.28 };
}

function testPropImpact(ctx: RayHitCtx, prop: ChunkProp, ecology: WorldEcology): boolean {
  const isWood = WOOD_PROPS.has(prop.kind);
  const isStone = STONE_PROPS.has(prop.kind);
  if ((!isWood && !isStone) || prop.elevation !== ctx.pr.elevation) return false;
  const t = segmentHitsEllipse({ x0: ctx.x0, y0: ctx.y0, x1: ctx.pr.x, y1: ctx.pr.y, box: propImpactBox(prop) });
  if (t === null) return false;
  const hx = ctx.x0 + (ctx.pr.x - ctx.x0) * t;
  const hy = ctx.y0 + (ctx.pr.y - ctx.y0) * t;
  if (isWood) {
    ctx.events.push({ kind: "arrowEmbed", x: hx, y: hy, dirX: ctx.dx, dirY: ctx.dy });
    ecology.spawnRecoverableArrow({ x: hx - ctx.dx * 0.14, y: hy - ctx.dy * 0.14, angle: Math.atan2(ctx.dy, ctx.dx), stuck: true });
  } else {
    ctx.events.push({ kind: "arrowRicochet", x: hx, y: hy, dirX: -ctx.dx, dirY: -ctx.dy });
  }
  return true;
}

function emitPebbleLand(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly ecology: WorldEcology; readonly events: WorldEvent[];
}): void {
  const tile = opts.cache.tileAt(Math.floor(opts.pr.x), Math.floor(opts.pr.y));
  const noiseR = opts.pr.noiseRadius ?? STEALTH_TUNING.pebbleNoiseRadiusTiles;
  opts.events.push({ kind: "pebbleLand", x: opts.pr.x, y: opts.pr.y, actorId: opts.pr.ownerId, value: tile.ground });
  opts.events.push({ kind: "distract", x: opts.pr.x, y: opts.pr.y, actorId: opts.pr.ownerId });
  opts.ecology.emitNoise({ x: opts.pr.x, y: opts.pr.y, radius: noiseR, sourceId: opts.pr.ownerId });
}

function stepPebbleProjectile(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly ecology: WorldEcology;
  readonly events: WorldEvent[]; readonly dt: number;
}): boolean {
  const { pr, cache, ecology, events, dt } = opts;
  const x0 = pr.x; const y0 = pr.y;
  pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  pr.z = Math.max(0, pr.z + pr.vz * dt);
  pr.vz -= PEBBLE_GRAVITY * dt;
  pr.ttl -= dt;
  if (pr.damage > 0) {
    const spd = Math.max(0.01, Math.hypot(pr.vx, pr.vy));
    const dx = pr.vx / spd; const dy = pr.vy / spd;
    const onStairs = cache.tileAt(Math.floor(pr.x), Math.floor(pr.y)).stairs;
    const hit = ecology.list.find((w) => !w.corpse && w.hp > 0 && projectileHitsHurtbox({
      x0, y0, x1: pr.x, y1: pr.y, projectileElevation: pr.elevation, projectileOnStairs: onStairs,
      box: projectileHurtbox(w, w.kind, cache),
    }) !== null);
    if (hit) {
      hit.staggerTimer = Math.max(hit.staggerTimer, 0.35);
      ecology.damageEntity({ entity: hit, damage: pr.damage, dirX: dx, dirY: dy, goreStyle: "chunk-spray", actorId: pr.ownerId, events });
      emitPebbleLand({ pr, cache, ecology, events });
      return false;
    }
  }
  if (pr.ttl <= 0 || pr.z <= 0) { emitPebbleLand({ pr, cache, ecology, events }); return false; }
  return true;
}

function stepArrowProjectile(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[]; readonly dt: number;
}): boolean {
  const { pr, cache, dummies, ecology, players, events, dt } = opts;
  const x0 = pr.x; const y0 = pr.y;
  pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.ttl -= dt;
  const spd = Math.max(0.01, Math.hypot(pr.vx, pr.vy));
  const tile = cache.tileAt(Math.floor(pr.x), Math.floor(pr.y));
  if (tile.elevation > pr.elevation) { events.push({ kind: "arrowRicochet", x: x0, y: y0, dirX: -pr.vx / spd, dirY: -pr.vy / spd }); return false; }
  const ctx: RayHitCtx = { cache, pr, x0, y0, dx: pr.vx / spd, dy: pr.vy / spd, onStairs: tile.stairs, events };
  if (hitDummy(ctx, dummies, ecology) || hitWildlife(ctx, ecology, players) || hitPlayer(ctx, players)) return false;
  if (cache.propsNear(pr.x, pr.y).some((prop) => testPropImpact(ctx, prop, ecology))) return false;
  if (pr.ttl > 0) return true;
  if (tile.ground !== GroundKind.DeepWater) {
    events.push({ kind: "arrowEmbed", x: pr.x, y: pr.y, dirX: ctx.dx, dirY: ctx.dy });
    ecology.spawnRecoverableArrow({ x: pr.x, y: pr.y, angle: Math.atan2(ctx.dy, ctx.dx), stuck: false });
  }
  return false;
}

function stepSingleProjectile(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[];
  readonly webs?: WorldWebNetwork | undefined; readonly dt: number;
}): boolean {
  if (opts.pr.kind === "web") return stepWebProjectile(opts);
  return opts.pr.kind === "pebble" ? stepPebbleProjectile(opts) : stepArrowProjectile(opts);
}

export function stepProjectileList(opts: {
  readonly cache: WorldChunkCache; readonly projectiles: SimProjectile[]; readonly dummies: readonly SimEntity[];
  readonly ecology: WorldEcology; readonly players: Map<string, CombatPlayerRef>; readonly events: WorldEvent[];
  readonly webs?: WorldWebNetwork | undefined; readonly dt: number;
}): void {
  for (let i = opts.projectiles.length - 1; i >= 0; i--) {
    if (!stepSingleProjectile({ ...opts, pr: opts.projectiles[i]! })) opts.projectiles.splice(i, 1);
  }
}

export function serializeProjectiles(projectiles: readonly SimProjectile[]): ProjectileSnapshot[] {
  return projectiles.map((pr) => ({
    id: pr.id, ownerId: pr.ownerId, kind: pr.kind, z: pr.z,
    x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, elevation: pr.elevation, charge: pr.charge, element: pr.element ?? "none",
  }));
}
