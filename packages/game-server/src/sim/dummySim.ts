/** Authoritative interactive training targets (straw dummy, burst slime target, sparring dummy). */
import {
  BLEED_DURATION_SEC, WorldChunkCache, isWithinSector,
  type GoreStyle, type GoreSubstance, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";

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
  idleResetTimer: number;
  telegraphTimer: number;
  attackCooldown: number;
  respawnTimer: number;
}

export interface CombatActorTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facingX: number;
  readonly facingY: number;
}

const KIND_SLIME = "slime-dummy" as const;
const KIND_SPAR = "spar-dummy" as const;

export const TRAINING_DUMMY_TUNING = {
  strawHp: 100,
  slimeHp: 45,
  slimeRespawnSec: 3.5,
  sparHp: 120,
  sparWindupSec: 0.85,
  sparCooldownSec: 1.85,
  sparRangeTiles: 2.35,
  sparDamage: 12,
  idleResetSec: 4.2,
  defaultRespawnSec: 2.0,
} as const;

function makeTarget(cache: WorldChunkCache, opts: {
  readonly id: string; readonly kind: SimEntity["kind"]; readonly substance: GoreSubstance;
  readonly x: number; readonly y: number; readonly hp: number;
}): SimEntity {
  return {
    id: opts.id, kind: opts.kind, substance: opts.substance, originX: opts.x, originY: opts.y,
    x: opts.x, y: opts.y, elevation: cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation,
    facingX: -1, facingY: 0, hp: opts.hp, maxHp: opts.hp,
    hitTimer: 0, staggerTimer: 0, bleedTimer: 0, idleResetTimer: 0,
    telegraphTimer: 0, attackCooldown: 0.8, respawnTimer: 0,
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
  e.telegraphTimer = 0;
  e.bleedTimer = 0;
}

export function damageDummy(input: {
  readonly entity: SimEntity;
  readonly damage: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly goreStyle: GoreStyle;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly actorId: string;
  readonly events: WorldEvent[];
}): boolean {
  const e = input.entity;
  if (e.respawnTimer > 0) return false;
  e.hp = Math.max(0, e.hp - input.damage);
  e.hitTimer = 0.24;
  e.idleResetTimer = TRAINING_DUMMY_TUNING.idleResetSec;
  if (input.goreStyle === "drip" && e.substance !== "straw") e.bleedTimer = BLEED_DURATION_SEC;
  const fatal = e.hp <= 0;
  const style: GoreStyle = fatal && e.kind === KIND_SLIME ? "explode-away" : input.goreStyle;
  input.events.push({
    kind: "hit", x: e.x, y: e.y, dirX: input.dirX, dirY: input.dirY, value: input.damage,
    actorId: input.actorId, targetId: e.id, comboStep: input.comboStep, sweepDir: input.sweepDir,
    goreStyle: style, substance: e.substance, fatal,
  });
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

function finishSparSwing(opts: {
  readonly e: SimEntity; readonly nearest: CombatActorTarget | null;
  readonly events: WorldEvent[]; readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const { e, nearest, events, onStrike } = opts;
  e.attackCooldown = TRAINING_DUMMY_TUNING.sparCooldownSec;
  events.push({ kind: "swing", x: e.x, y: e.y, dirX: e.facingX, dirY: e.facingY, actorId: e.id });
  if (nearest && isWithinSector({ origin: e, dir: { x: e.facingX, y: e.facingY }, target: nearest, range: TRAINING_DUMMY_TUNING.sparRangeTiles, halfArcRad: 1.0 })) {
    onStrike(e, nearest, TRAINING_DUMMY_TUNING.sparDamage);
  }
}

function stepSparDummy(input: {
  readonly e: SimEntity;
  readonly dt: number;
  readonly players: readonly CombatActorTarget[];
  readonly events: WorldEvent[];
  readonly onStrike: (entity: SimEntity, target: CombatActorTarget, damage: number) => void;
}): void {
  const { e, dt, players, events, onStrike } = input;
  if (e.kind !== KIND_SPAR || e.staggerTimer > 0) { e.telegraphTimer = 0; return; }
  const { nearest, dist } = faceNearestTarget(e, players);
  if (e.telegraphTimer > 0) {
    e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
    if (e.telegraphTimer === 0) finishSparSwing({ e, nearest, events, onStrike });
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
  e.bleedTimer = Math.max(0, e.bleedTimer - dt);
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
  return dummies
    .filter((e) => e.respawnTimer <= 0)
    .map((e) => ({
      id: e.id, kind: e.kind, substance: e.substance, x: e.x, y: e.y, elevation: e.elevation,
      facingX: e.facingX, facingY: e.facingY, hp: e.hp, maxHp: e.maxHp,
      hitTimer: e.hitTimer, staggerTimer: e.staggerTimer, bleedTimer: e.bleedTimer,
      telegraphProgress: e.telegraphTimer > 0 ? Math.min(1, 1 - e.telegraphTimer / TRAINING_DUMMY_TUNING.sparWindupSec) : 0,
    }));
}
