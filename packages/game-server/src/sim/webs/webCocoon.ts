/** Spider ranged web spit AI, stuck-victim silk cocoon wrapping, locked poison bite, and escape cuts/burns. */
import {
  MELEE_FEEL_TUNING, WorldChunkCache, canReachMeleeTarget, hasElevationLineOfSight, playerHurtbox, projectileHitsHurtbox,
  type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { inflictPoison } from "../combat/statusEffects.js";
import { moveCreatureToward, stepSpiderAmbushCheck } from "../wildlife/creatureBehaviors.js";
import { clearNavPath, faceTarget } from "../wildlife/creatureNavigation.js";
import { CREATURE_SPECS, ST_CHASE, ST_RETURN, type WildlifeEntity } from "../wildlife/creatureSpecs.js";
import type { CombatTarget } from "../wildlife/factionTargeting.js";
import type { SimProjectile } from "../wildlife/projectileSim.js";
import type { WorldWebNetwork } from "./webNetwork.js";

function breakCocoonFree(opts: {
  readonly target: CombatPlayerRef; readonly actorId: string; readonly events: WorldEvent[]; readonly webs?: WorldWebNetwork | undefined;
}): void {
  const c = opts.target.combat;
  c.cocoonProgress = 0; c.cocoonHp = 0; c.cocoonBurning = false;
  c.webStick = 0; c.webStuckSec = 0; c.poisonLocked = false;
  opts.webs?.clearAround(opts.target.x, opts.target.y, 1.35);
  opts.events.push({ kind: "cocoonBreak", x: opts.target.x, y: opts.target.y, actorId: opts.actorId, targetId: opts.target.id });
}

export function tryCutOrIgniteCocoon(opts: {
  readonly target: CombatPlayerRef; readonly sharp: boolean; readonly ignites: boolean;
  readonly damage: number; readonly actorId: string; readonly events: WorldEvent[]; readonly webs?: WorldWebNetwork | undefined;
}): { readonly handled: boolean; readonly freed: boolean } {
  const c = opts.target.combat;
  if (c.cocoonProgress <= 0 || (!opts.sharp && !opts.ignites)) return { handled: false, freed: false };
  if (opts.ignites) c.cocoonBurning = true;
  if (opts.sharp) {
    c.cocoonHp = Math.max(0, c.cocoonHp - Math.max(16, opts.damage));
    c.webStick = Math.max(0, c.webStick - 0.45);
  }
  if (c.cocoonHp <= 0) {
    breakCocoonFree({ target: opts.target, actorId: opts.actorId, events: opts.events, webs: opts.webs });
    return { handled: true, freed: true };
  }
  opts.events.push({ kind: "webCut", x: opts.target.x, y: opts.target.y, actorId: opts.actorId, targetId: opts.target.id });
  return { handled: true, freed: false };
}

export function stepPlayerWebAndCocoonTimers(opts: {
  readonly p: CombatPlayerRef; readonly dt: number; readonly events: WorldEvent[]; readonly webs: WorldWebNetwork;
}): void {
  const c = opts.p.combat;
  if (c.respawnTimer > 0) return;
  if (c.webStick >= MELEE_FEEL_TUNING.webStuckThreshold) c.webStuckSec += opts.dt;
  else if (c.cocoonProgress <= 0) c.webStuckSec = 0;
  if (!c.cocoonBurning || c.cocoonProgress <= 0) return;
  c.cocoonHp = Math.max(0, c.cocoonHp - MELEE_FEEL_TUNING.cocoonFireDps * opts.dt);
  if (c.cocoonHp <= 0) breakCocoonFree({ target: opts.p, actorId: opts.p.id, events: opts.events, webs: opts.webs });
}

function deaggroSpiderAfterCocoon(spider: WildlifeEntity): void {
  spider.aiState = ST_RETURN;
  spider.targetPlayerId = null; spider.targetKind = null;
  spider.suspicion = 0; spider.investigateTimer = 0; spider.alertedTimer = 0;
  spider.provokedTimer = 0; spider.telegraphTimer = 0; spider.spottedPopTimer = 0;
  spider.pounceUsed = false;
  spider.webShotCooldown = Math.max(spider.webShotCooldown, MELEE_FEEL_TUNING.webShotCooldownSec);
  clearNavPath(spider);
}

function advanceCocoonWrap(opts: {
  readonly spider: WildlifeEntity; readonly victim: CombatPlayerRef; readonly dt: number; readonly events: WorldEvent[];
}): void {
  const { spider, victim, dt, events } = opts;
  const c = victim.combat;
  const wasUnwrapped = c.cocoonProgress === 0;
  if (c.cocoonHp <= 0) c.cocoonHp = MELEE_FEEL_TUNING.cocoonMaxHp;
  c.cocoonProgress = Math.min(1, c.cocoonProgress + dt / MELEE_FEEL_TUNING.cocoonWrapDurationSec);
  if (wasUnwrapped) events.push({ kind: "cocoonWrap", x: victim.x, y: victim.y, actorId: spider.id, targetId: victim.id });
  if (c.cocoonProgress < 1) return;
  inflictPoison(c, { locked: true });
  const bite = c.godMode ? 0 : MELEE_FEEL_TUNING.cocoonBiteDamage;
  if (bite > 0) c.hp = Math.max(1, c.hp - bite);
  events.push({ kind: "hit", x: victim.x, y: victim.y, dirX: spider.facingX, dirY: spider.facingY, value: bite, actorId: spider.id, targetId: victim.id, goreStyle: "drip", substance: "blood" });
  events.push({ kind: "cocoonWrap", x: victim.x, y: victim.y, actorId: spider.id, targetId: victim.id, value: 1 });
  deaggroSpiderAfterCocoon(spider);
}

function canShootWebAt(opts: {
  readonly cache: WorldChunkCache; readonly spider: WildlifeEntity; readonly target: CombatTarget;
}): boolean {
  const { cache, spider, target } = opts;
  if (spider.kind !== "spider" || spider.webShotCooldown > 0 || spider.telegraphTimer > 0) return false;
  const dist = Math.hypot(target.x - spider.x, target.y - spider.y);
  if (dist < MELEE_FEEL_TUNING.webShotMinRange || dist > MELEE_FEEL_TUNING.webShotMaxRange) return false;
  return hasElevationLineOfSight({ cache, fromX: spider.x, fromY: spider.y, fromElev: spider.elevation, toX: target.x, toY: target.y, toElev: target.elevation });
}

function needsCocoonWrap(victim: CombatPlayerRef | undefined): victim is CombatPlayerRef {
  if (!victim || victim.combat.respawnTimer > 0) return false;
  if (victim.combat.cocoonProgress > 0 && victim.combat.cocoonProgress < 1) return true;
  return victim.combat.webStick >= MELEE_FEEL_TUNING.webStuckThreshold && victim.combat.webStuckSec >= MELEE_FEEL_TUNING.webStuckCocoonDelaySec;
}

function stepSpiderWebAndCocoon(opts: {
  readonly cache: WorldChunkCache; readonly spider: WildlifeEntity; readonly target: CombatTarget;
  readonly players: readonly CombatPlayerRef[]; readonly dt: number; readonly events: WorldEvent[];
  readonly spawnWeb: (spider: WildlifeEntity, target: CombatTarget) => void;
}): boolean {
  const { cache, spider, target, players, dt, events, spawnWeb } = opts;
  if (spider.kind !== "spider" || target.targetKind !== "player") return false;
  const victim = players.find((p) => p.id === target.id);
  if (needsCocoonWrap(victim)) {
    faceTarget(spider, victim); spider.aiState = ST_CHASE;
    if (Math.hypot(victim.x - spider.x, victim.y - spider.y) > 1.18 || !canReachMeleeTarget(cache, spider, victim)) {
      moveCreatureToward({ cache, e: spider, tx: victim.x, ty: victim.y, speed: CREATURE_SPECS.spider.speed * 1.15, dt, stopRadius: 0.95 });
    } else advanceCocoonWrap({ spider, victim, dt, events });
    return true;
  }
  if (!canShootWebAt({ cache, spider, target })) return false;
  faceTarget(spider, target); spider.webShotCooldown = MELEE_FEEL_TUNING.webShotCooldownSec;
  spawnWeb(spider, target);
  events.push({ kind: "webSpit", x: spider.x, y: spider.y, dirX: spider.facingX, dirY: spider.facingY, actorId: spider.id, entityKind: "spider" });
  return true;
}

export function holdsSpiderConcealedAmbush(opts: {
  readonly cache: WorldChunkCache; readonly e: WildlifeEntity; readonly perceived: CombatTarget; readonly dayPhase: number;
}): boolean {
  const { cache, e, perceived, dayPhase } = opts;
  if (e.kind !== "spider" || e.investigateTimer > 0) return false;
  if (stepSpiderAmbushCheck({ cache, e, target: perceived, dayPhase })) return false;
  e.suspicion = Math.min(e.suspicion, 0.25);
  return true;
}

export function stepSpiderPursuitActions(opts: {
  readonly cache: WorldChunkCache; readonly spider: WildlifeEntity; readonly target: CombatTarget;
  readonly players: readonly CombatPlayerRef[]; readonly dayPhase: number; readonly dt: number;
  readonly events: WorldEvent[]; readonly spawnWeb?: ((spider: WildlifeEntity, target: CombatTarget) => void) | undefined;
}): boolean {
  if (opts.spider.kind !== "spider") return false;
  if (!stepSpiderAmbushCheck({ cache: opts.cache, e: opts.spider, target: opts.target, dayPhase: opts.dayPhase })) return true;
  if (!opts.spawnWeb) return false;
  return stepSpiderWebAndCocoon({ ...opts, spawnWeb: opts.spawnWeb });
}

export function createWebProjectile(opts: {
  readonly id: string; readonly spider: WildlifeEntity; readonly targetX: number; readonly targetY: number;
}): SimProjectile {
  const { id, spider, targetX, targetY } = opts;
  const dx = targetX - spider.x;
  const dy = targetY - spider.y;
  const dist = Math.max(0.2, Math.hypot(dx, dy));
  const spd = MELEE_FEEL_TUNING.webShotSpeed;
  return {
    id, ownerId: spider.id, kind: "web", originX: spider.x, originY: spider.y,
    x: spider.x + (dx / dist) * 0.4, y: spider.y + (dy / dist) * 0.4, z: 0.35,
    vx: (dx / dist) * spd, vy: (dy / dist) * spd, vz: 0,
    elevation: spider.elevation, charge: 1, damage: 0, ttl: Math.min(0.85, Math.max(0.12, (dist - 0.25) / spd)),
  };
}

function findWebPlayerHit(opts: {
  readonly cache: WorldChunkCache; readonly players: Map<string, CombatPlayerRef>;
  readonly x0: number; readonly y0: number; readonly pr: SimProjectile; readonly onStairs: boolean;
}): CombatPlayerRef | undefined {
  for (const p of opts.players.values()) {
    if (p.combat.respawnTimer > 0) continue;
    const hitT = projectileHitsHurtbox({
      x0: opts.x0, y0: opts.y0, x1: opts.pr.x, y1: opts.pr.y,
      projectileElevation: opts.pr.elevation, projectileOnStairs: opts.onStairs,
      box: playerHurtbox(p, opts.cache),
    });
    if (hitT !== null) return p;
  }
  return undefined;
}

function resolveWebLanding(opts: {
  readonly hitP: CombatPlayerRef | undefined; readonly blocked: boolean; readonly x0: number; readonly y0: number; readonly pr: SimProjectile;
}): { readonly x: number; readonly y: number } {
  if (opts.hitP) return { x: opts.hitP.x, y: opts.hitP.y };
  return opts.blocked ? { x: opts.x0, y: opts.y0 } : { x: opts.pr.x, y: opts.pr.y };
}

export function stepWebProjectile(opts: {
  readonly pr: SimProjectile; readonly cache: WorldChunkCache; readonly players: Map<string, CombatPlayerRef>;
  readonly webs?: WorldWebNetwork | undefined; readonly dt: number;
}): boolean {
  const { pr, cache, players, webs, dt } = opts;
  const x0 = pr.x;
  const y0 = pr.y;
  pr.x += pr.vx * dt;
  pr.y += pr.vy * dt;
  pr.ttl -= dt;
  const destTile = cache.tileAt(Math.floor(pr.x), Math.floor(pr.y));
  const blocked = destTile.elevation > pr.elevation;
  const hitP = blocked ? undefined : findWebPlayerHit({ cache, players, x0, y0, pr, onStairs: destTile.stairs });
  if (!hitP && !blocked && pr.ttl > 0) return true;
  const landing = resolveWebLanding({ hitP, blocked, x0, y0, pr });
  if (!webs) return false;
  webs.spawnWebCluster({ cache, x: landing.x, y: landing.y });
  if (hitP) webs.applyDirectWebHit(hitP);
  return false;
}
