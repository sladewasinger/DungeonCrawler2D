/** Authoritative interactive training targets (straw dummy, burst slime target, sparring dummy). */
import {
  BLEED_DURATION_SEC, MELEE_FEEL_TUNING, WorldChunkCache, attackHitboxHitsHurtbox,
  buildEntityAttackHitbox, getEntityAttackSpec, playerHurtbox,
  type GoreStyle, type GoreSubstance, type WeaponArchetype, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import { igniteBurnable, stepBurnTarget } from "./combat/statusEffects.js";

export interface SimEntity {
  readonly id: string;
  readonly kind: "dummy" | "slime-dummy" | "spar-dummy";
  readonly substance: GoreSubstance;
  readonly originX: number;
  readonly originY: number;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  hp: number;
  maxHp: number;
  hitTimer: number;
  staggerTimer: number;
  bleedTimer: number;
  burnTimer: number;
  burnTickAcc: number;
  parried: boolean;
  blocking: boolean;
  idleResetTimer: number;
  telegraphTimer: number;
  strikeTimer: number;
  readonly strikeHitIds: Set<string>;
  attackCooldown: number;
  respawnTimer: number;
}

export interface CombatActorTarget {
  readonly id: string; readonly x: number; readonly y: number; readonly elevation?: number | undefined; readonly facingX: number; readonly facingY: number;
}

const KIND_SLIME = "slime-dummy" as const;
const KIND_SPAR = "spar-dummy" as const;

export const TRAINING_DUMMY_TUNING = {
  strawHp: 100, slimeHp: 45, slimeRespawnSec: 3.5, sparHp: 120,
  sparWindupSec: 0.85, sparCooldownSec: 1.85, sparRangeTiles: 2.35,
  sparDamage: 12, idleResetSec: 4.2, defaultRespawnSec: 2.0,
} as const;

function makeTarget(cache: WorldChunkCache, opts: {
  readonly id: string; readonly kind: SimEntity["kind"]; readonly substance: GoreSubstance;
  readonly x: number; readonly y: number; readonly hp: number;
}): SimEntity {
  return {
    id: opts.id, kind: opts.kind, substance: opts.substance, originX: opts.x, originY: opts.y,
    x: opts.x, y: opts.y, elevation: cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation,
    facingX: -1, facingY: 0, hp: opts.hp, maxHp: opts.hp,
    hitTimer: 0, staggerTimer: 0, bleedTimer: 0, burnTimer: 0, burnTickAcc: 0, parried: false, blocking: false, idleResetTimer: 0,
    telegraphTimer: 0, strikeTimer: 0, strikeHitIds: new Set<string>(), attackCooldown: 0.8, respawnTimer: 0,
  };
}

export function createTrainingDummies(cache: WorldChunkCache): SimEntity[] {
  return [
    makeTarget(cache, { id: "dummy-straw", kind: "dummy", substance: "straw", x: 9.5, y: 0.5, hp: TRAINING_DUMMY_TUNING.strawHp }),
    makeTarget(cache, { id: "dummy-slime", kind: KIND_SLIME, substance: "slime", x: 9.5, y: 2.5, hp: TRAINING_DUMMY_TUNING.slimeHp }),
    makeTarget(cache, { id: "dummy-spar", kind: KIND_SPAR, substance: "blood", x: 10.5, y: -1.5, hp: TRAINING_DUMMY_TUNING.sparHp }),
  ];
}

function finalizeDummyKill(e: SimEntity): void {
  e.respawnTimer = e.kind === KIND_SLIME ? TRAINING_DUMMY_TUNING.slimeRespawnSec : TRAINING_DUMMY_TUNING.defaultRespawnSec;
  e.telegraphTimer = 0; e.strikeTimer = 0; e.strikeHitIds.clear();
  e.bleedTimer = 0; e.burnTimer = 0;
  e.burnTickAcc = 0; e.parried = false; e.blocking = false;
}

export interface DamageDummyInput {
  readonly entity: SimEntity;
  readonly damage: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly goreStyle: GoreStyle;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly actorId: string;
  readonly events: WorldEvent[];
  readonly ignites?: boolean | undefined;
  readonly heavy?: boolean | undefined;
  readonly weaponArchetype?: WeaponArchetype | undefined;
  readonly hitstopSec?: number | undefined;
  readonly shakePx?: number | undefined;
}

function resolveDummyDamageAndRiposte(e: SimEntity, input: DamageDummyInput): number {
  let dmg = input.damage;
  if (e.blocking && !input.heavy) {
    dmg = Math.max(1, Math.round(dmg * 0.25));
    input.events.push({ kind: "block", x: e.x, y: e.y, value: dmg, targetId: e.id, actorId: input.actorId });
    return dmg;
  }
  if (e.blocking && input.heavy) {
    e.blocking = false;
    e.staggerTimer = Math.max(e.staggerTimer, MELEE_FEEL_TUNING.guardBreakStaggerSec);
    input.events.push({ kind: "guardBreak", x: e.x, y: e.y, targetId: e.id, actorId: input.actorId, hitstopSec: MELEE_FEEL_TUNING.guardBreakHitstopSec, shakePx: MELEE_FEEL_TUNING.guardBreakShakePx });
  }
  if (e.parried && e.staggerTimer > 0) {
    dmg = Math.round(dmg * MELEE_FEEL_TUNING.riposteDamageMult);
    e.parried = false;
    input.events.push({ kind: "riposte", x: e.x, y: e.y, value: dmg, actorId: input.actorId, targetId: e.id, hitstopSec: MELEE_FEEL_TUNING.parryHitstopSec, shakePx: 3.0 });
  }
  return dmg;
}

function buildDummyHitEvent(input: DamageDummyInput, dmg: number, fatal: boolean): WorldEvent {
  const e = input.entity;
  const style: GoreStyle = fatal && e.kind === KIND_SLIME ? "explode-away" : input.goreStyle;
  return {
    kind: "hit", x: e.x, y: e.y, dirX: input.dirX, dirY: input.dirY, value: dmg,
    actorId: input.actorId, targetId: e.id, comboStep: input.comboStep, sweepDir: input.sweepDir,
    goreStyle: style, substance: e.substance, fatal,
    ...(input.heavy ? { heavy: true } : {}),
    ...(input.weaponArchetype ? { weaponArchetype: input.weaponArchetype } : {}),
    ...(input.hitstopSec !== undefined ? { hitstopSec: input.hitstopSec } : {}),
    ...(input.shakePx !== undefined ? { shakePx: input.shakePx } : {}),
  };
}

export function damageDummy(input: DamageDummyInput): boolean {
  const e = input.entity;
  if (e.respawnTimer > 0) return false;
  const dmg = resolveDummyDamageAndRiposte(e, input);
  e.hp = Math.max(0, e.hp - dmg);
  e.hitTimer = 0.24;
  e.idleResetTimer = TRAINING_DUMMY_TUNING.idleResetSec;
  if (input.goreStyle === "drip" && e.substance !== "straw") e.bleedTimer = BLEED_DURATION_SEC;
  if (input.ignites) igniteBurnable({ target: e, x: e.x, y: e.y, targetId: e.id, events: input.events });
  const fatal = e.hp <= 0;
  input.events.push(buildDummyHitEvent(input, dmg, fatal));
  if (fatal) finalizeDummyKill(e);
  return true;
}

function faceNearestTarget(e: SimEntity, players: readonly CombatActorTarget[]): { readonly nearest: CombatActorTarget | null; readonly dist: number } {
  let nearest: CombatActorTarget | null = null;
  let dist = Infinity;
  for (const t of players) {
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d < dist) { nearest = t; dist = d; }
  }
  if (nearest && dist <= TRAINING_DUMMY_TUNING.sparRangeTiles) {
    const mag = Math.max(0.01, dist);
    e.facingX = (nearest.x - e.x) / mag;
    e.facingY = (nearest.y - e.y) / mag;
  }
  return { nearest, dist };
}

function stepSparActiveHit(opts: {
  readonly e: SimEntity; readonly players: readonly CombatActorTarget[];
  readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const hitbox = buildEntityAttackHitbox(opts.e);
  for (const t of opts.players) {
    if (opts.e.strikeHitIds.has(t.id) || !attackHitboxHitsHurtbox(hitbox, playerHurtbox(t))) continue;
    opts.e.strikeHitIds.add(t.id);
    opts.onStrike(opts.e, t, TRAINING_DUMMY_TUNING.sparDamage);
  }
}

function finishSparSwing(opts: {
  readonly e: SimEntity; readonly players: readonly CombatActorTarget[];
  readonly events: WorldEvent[]; readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const { e, events } = opts;
  e.attackCooldown = TRAINING_DUMMY_TUNING.sparCooldownSec;
  e.strikeTimer = getEntityAttackSpec(KIND_SPAR).activeSec;
  e.strikeHitIds.clear();
  events.push({ kind: "swing", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id });
  stepSparActiveHit(opts);
}

function stepSparDummy(input: {
  readonly e: SimEntity; readonly dt: number; readonly players: readonly CombatActorTarget[];
  readonly events: WorldEvent[]; readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const { e, dt, players, events, onStrike } = input;
  if (e.kind !== KIND_SPAR || e.staggerTimer > 0) { e.telegraphTimer = 0; e.strikeTimer = 0; return; }
  if (e.strikeTimer > 0) { e.strikeTimer = Math.max(0, e.strikeTimer - dt); stepSparActiveHit({ e, players, onStrike }); return; }
  const { dist } = faceNearestTarget(e, players);
  if (e.telegraphTimer > 0) {
    e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
    if (e.telegraphTimer === 0) finishSparSwing({ e, players, events, onStrike });
    return;
  }
  if (e.attackCooldown <= 0 && dist <= TRAINING_DUMMY_TUNING.sparRangeTiles) {
    e.telegraphTimer = TRAINING_DUMMY_TUNING.sparWindupSec;
    events.push({ kind: "telegraph", x: e.x, y: e.y, actorId: e.id });
  }
}

function tickSingleDummy(e: SimEntity, input: {
  readonly dt: number;
  readonly players: readonly CombatActorTarget[];
  readonly events: WorldEvent[];
  readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const { dt } = input;
  if (e.respawnTimer > 0) {
    e.respawnTimer = Math.max(0, e.respawnTimer - dt);
    if (e.respawnTimer === 0) e.hp = e.maxHp;
    return;
  }
  e.hitTimer = Math.max(0, e.hitTimer - dt);
  e.staggerTimer = Math.max(0, e.staggerTimer - dt);
  if (e.staggerTimer === 0) e.parried = false;
  e.bleedTimer = Math.max(0, e.bleedTimer - dt);
  stepBurnTarget({
    target: e, dt, kind: e.kind, x: e.x, y: e.y, targetId: e.id, events: input.events,
    onTickDamage: (dmg) => { e.hp = Math.max(0, e.hp - dmg); if (e.hp <= 0) finalizeDummyKill(e); },
  });
  e.attackCooldown = Math.max(0, e.attackCooldown - dt);
  e.idleResetTimer = Math.max(0, e.idleResetTimer - dt);
  if (e.idleResetTimer === 0 && e.hp < e.maxHp) e.hp = e.maxHp;
  stepSparDummy({ e, dt, players: input.players, events: input.events, onStrike: input.onStrike });
}

export function stepTrainingDummies(input: {
  readonly dummies: SimEntity[];
  readonly dt: number;
  readonly players: readonly CombatActorTarget[];
  readonly events: WorldEvent[];
  readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  for (const e of input.dummies) tickSingleDummy(e, input);
}

export function serializeDummies(dummies: readonly SimEntity[]): WorldEntitySnapshot[] {
  const activeSec = Math.max(0.05, getEntityAttackSpec(KIND_SPAR).activeSec);
  return dummies
    .filter((e) => e.respawnTimer <= 0)
    .map((e) => {
      const atkProg = e.strikeTimer > 0 ? Math.min(1, Math.max(0.05, 1 - e.strikeTimer / activeSec)) : 0;
      return {
        id: e.id, kind: e.kind, substance: e.substance, x: e.x, y: e.y, elevation: e.elevation,
        facingX: e.facingX, facingY: e.facingY, hp: e.hp, maxHp: e.maxHp,
        hitTimer: e.hitTimer, staggerTimer: e.staggerTimer, bleedTimer: e.bleedTimer,
        ...(e.burnTimer > 0 ? { burning: true } : {}),
        ...(e.parried && e.staggerTimer > 0 ? { parried: true } : {}),
        ...(atkProg > 0 ? { attackProgress: atkProg } : {}),
        telegraphProgress: e.telegraphTimer > 0 ? Math.min(1, 1 - e.telegraphTimer / TRAINING_DUMMY_TUNING.sparWindupSec) : 0,
      };
    });
}
