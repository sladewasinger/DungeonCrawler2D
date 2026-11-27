/** Shared burn & venom poison status ticking helpers. */
import { MELEE_FEEL_TUNING, isBurnVulnerable, type WorldEvent } from "@dc2d/engine";

export interface PoisonableTarget {
  hp: number;
  poisonTimer: number;
  poisonTickAcc: number;
  poisonLocked: boolean;
  poisonDamagePerTick?: number;
}

export function inflictPoison(target: PoisonableTarget, opts: { readonly locked?: boolean; readonly damagePerTick?: number } = {}): void {
  target.poisonTimer = Math.max(target.poisonTimer, MELEE_FEEL_TUNING.poisonDurationSec);
  if (opts.damagePerTick && opts.damagePerTick > 0) {
    target.poisonDamagePerTick = Math.max(target.poisonDamagePerTick ?? 0, opts.damagePerTick);
  }
  if (opts.locked) target.poisonLocked = true;
}

function flushPoisonTicks(opts: {
  readonly target: PoisonableTarget; readonly x: number; readonly y: number; readonly targetId: string;
  readonly events: WorldEvent[]; readonly onTickDamage: (dmg: number) => void;
}): void {
  const { target, x, y, targetId, events, onTickDamage } = opts;
  const interval = target.poisonLocked ? MELEE_FEEL_TUNING.cocoonPoisonTickIntervalSec : MELEE_FEEL_TUNING.poisonTickIntervalSec;
  const dmg = target.poisonLocked ? MELEE_FEEL_TUNING.cocoonPoisonTickDamage : (target.poisonDamagePerTick || MELEE_FEEL_TUNING.poisonTickDamage);
  while (target.poisonTickAcc >= interval && target.hp > 0) {
    target.poisonTickAcc -= interval;
    onTickDamage(dmg);
    events.push({ kind: "poisonTick", x, y, value: dmg, targetId, fatal: target.hp <= 0 });
  }
}

export function stepPoisonTarget(opts: {
  readonly target: PoisonableTarget; readonly dt: number; readonly x: number; readonly y: number;
  readonly targetId: string; readonly events: WorldEvent[]; readonly onTickDamage: (dmg: number) => void;
}): void {
  const { target, dt } = opts;
  const active = target.poisonTimer > 0 || target.poisonLocked;
  if (!active || target.hp <= 0) return;
  if (!target.poisonLocked) target.poisonTimer = Math.max(0, target.poisonTimer - dt);
  target.poisonTickAcc += dt;
  flushPoisonTicks(opts);
  if ((!target.poisonLocked && target.poisonTimer <= 0) || target.hp <= 0) {
    target.poisonTimer = 0; target.poisonTickAcc = 0; target.poisonLocked = false;
  }
}

export interface BurnableTarget {
  hp: number;
  readonly maxHp: number;
  burnTimer: number;
  burnTickAcc: number;
  burnDamagePerTick?: number;
  inWater?: boolean | undefined;
  inDeepWater?: boolean | undefined;
}

export interface BleedableTarget {
  hp: number;
  bleedTimer: number;
  bleedTickAcc: number;
  bleedDamagePerTick: number;
}

const BLEED_TICK_INTERVAL_SEC = 1.0;

export function stepBleedTarget(opts: {
  readonly target: BleedableTarget; readonly dt: number; readonly x: number; readonly y: number;
  readonly targetId: string; readonly events: WorldEvent[]; readonly onTickDamage: (dmg: number) => void;
}): void {
  const { target, dt, x, y, targetId, events, onTickDamage } = opts;
  if (target.bleedTimer <= 0 || target.bleedDamagePerTick <= 0 || target.hp <= 0) return;
  target.bleedTimer = Math.max(0, target.bleedTimer - dt);
  target.bleedTickAcc += dt;
  while (target.bleedTickAcc >= BLEED_TICK_INTERVAL_SEC && target.hp > 0) {
    target.bleedTickAcc -= BLEED_TICK_INTERVAL_SEC;
    const dmg = target.bleedDamagePerTick;
    onTickDamage(dmg);
    events.push({ kind: "hit", x, y, dirX: 0, dirY: 1, value: dmg, goreStyle: "drip", targetId, fatal: target.hp <= 0 });
  }
  if (target.bleedTimer <= 0 || target.hp <= 0) {
    target.bleedTimer = 0; target.bleedTickAcc = 0; target.bleedDamagePerTick = 0;
  }
}

function isTargetInWater(t: Pick<BurnableTarget, "inWater" | "inDeepWater">): boolean {
  return Boolean(t.inWater || t.inDeepWater);
}

export function igniteBurnable(opts: {
  readonly target: BurnableTarget;
  readonly x: number;
  readonly y: number;
  readonly targetId: string;
  readonly damagePerTick?: number | undefined;
  readonly events: WorldEvent[];
}): boolean {
  const { target, x, y, targetId, damagePerTick, events } = opts;
  if (isTargetInWater(target)) {
    if (target.burnTimer > 0) extinguishBurn({ target, x, y, targetId, events });
    return false;
  }
  const fresh = target.burnTimer <= 0;
  target.burnTimer = MELEE_FEEL_TUNING.burnDurationSec;
  if (damagePerTick && damagePerTick > 0) {
    target.burnDamagePerTick = Math.max(target.burnDamagePerTick ?? 0, damagePerTick);
  }
  if (fresh) target.burnTickAcc = 0;
  return true;
}

function extinguishBurn(opts: {
  readonly target: BurnableTarget;
  readonly x: number;
  readonly y: number;
  readonly targetId: string;
  readonly events: WorldEvent[];
}): void {
  const { target, x, y, targetId, events } = opts;
  if (target.burnTimer <= 0) return;
  target.burnTimer = 0;
  target.burnTickAcc = 0;
  events.push({ kind: "burnExtinguish", x, y, targetId });
}

function flushBurnTicks(opts: {
  readonly target: BurnableTarget;
  readonly kind?: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly targetId: string;
  readonly events: WorldEvent[];
  readonly onTickDamage: (dmg: number) => void;
}): void {
  const { target, kind, x, y, targetId, events, onTickDamage } = opts;
  while (target.burnTickAcc >= MELEE_FEEL_TUNING.burnTickIntervalSec && target.hp > 0) {
    target.burnTickAcc -= MELEE_FEEL_TUNING.burnTickIntervalSec;
    const base = target.burnDamagePerTick || MELEE_FEEL_TUNING.burnTickDamage;
    const dmg = isBurnVulnerable(kind) ? Math.round(base * MELEE_FEEL_TUNING.burnBonusMult) : base;
    onTickDamage(dmg);
    events.push({ kind: "burnTick", x, y, value: dmg, targetId, fatal: target.hp <= 0 });
  }
}

export function stepBurnTarget(opts: {
  readonly target: BurnableTarget;
  readonly dt: number;
  readonly kind?: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly targetId: string;
  readonly events: WorldEvent[];
  readonly onTickDamage: (dmg: number) => void;
}): void {
  const { target, dt } = opts;
  if (target.burnTimer <= 0 || target.hp <= 0) return;
  if (isTargetInWater(target)) { extinguishBurn(opts); return; }
  target.burnTimer = Math.max(0, target.burnTimer - dt);
  target.burnTickAcc += dt;
  flushBurnTicks(opts);
  if (target.burnTimer <= 0 || target.hp <= 0) { target.burnTimer = 0; target.burnTickAcc = 0; }
}
