import {
  TICK_RATE,
  resolveWeaponProfile,
  weaponHitboxIntersectsHurtbox,
  type EffectEvent,
  type ItemDef,
  type WeaponProfile,
} from "@dc2d/engine";
import { resolveMeleeContact } from "../../actions/melee/contact.js";
import {
  isFinalMeleeHitboxResolutionTick,
  isMeleeHitboxResolutionTick,
  MELEE_HITBOX_TIMING,
} from "../../actions/melee/meleeHitboxTuning.js";
import type { ActiveMeleeAttack } from "../../state/meleeAttackState.js";
import type { EnemySlot, SimState } from "../../state/state.js";

interface TrainingAttackRuntime {
  nextAttackTick: number;
  active?: ActiveMeleeAttack;
}

export interface TrainingWeaponHitbox {
  readonly direction: { readonly x: number; readonly y: number };
  readonly profile: WeaponProfile;
}

const runtimes = new WeakMap<EnemySlot, TrainingAttackRuntime>();

/** Advances the configured sword exercise without entering ordinary enemy AI. */
export function stepTrainingDummyAttack(
  sim: SimState,
  enemy: EnemySlot,
  effectEvents: EffectEvent[],
): void {
  const training = enemy.def.trainingWeapon;
  if (!training) return;
  const intervalTicks = Math.round(training.attackIntervalSeconds * TICK_RATE);
  const runtime = runtimeFor(enemy, sim.tickCount, intervalTicks);
  stepActiveHitbox({ sim, enemy, runtime, effectEvents });
  if (runtime.active || sim.tickCount < runtime.nextAttackTick) return;
  runtime.active = beginTrainingAttack(sim, enemy, training.itemId);
  runtime.nextAttackTick += intervalTicks;
  stepActiveHitbox({ sim, enemy, runtime, effectEvents });
}

export function activeTrainingWeaponHitbox(
  enemy: EnemySlot,
): TrainingWeaponHitbox | undefined {
  const active = runtimes.get(enemy)?.active;
  return active ? { direction: active.direction, profile: active.profile } : undefined;
}

function runtimeFor(
  enemy: EnemySlot,
  tick: number,
  intervalTicks: number,
): TrainingAttackRuntime {
  const existing = runtimes.get(enemy);
  if (existing) return existing;
  const created = { nextAttackTick: tick + intervalTicks };
  runtimes.set(enemy, created);
  return created;
}

interface ActiveHitboxStep {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly runtime: TrainingAttackRuntime;
  readonly effectEvents: EffectEvent[];
}

function stepActiveHitbox(input: ActiveHitboxStep): void {
  const { sim, enemy, runtime, effectEvents } = input;
  const attack = runtime.active;
  if (!attack) return;
  if (!isMeleeHitboxResolutionTick(sim.tickCount, attack.startedAtTick)) {
    deactivateTrainingHitbox(enemy, runtime);
    return;
  }
  if (attack.lastResolvedAtTick === sim.tickCount) return;
  attack.lastResolvedAtTick = sim.tickCount;
  enemy.animation = {
    state: "attack",
    ticksRemaining: remainingTrainingHitboxTicks(sim.tickCount, attack.startedAtTick),
  };
  resolvePlayerContacts({ sim, enemy, effectEvents }, attack);
  if (isFinalMeleeHitboxResolutionTick(sim.tickCount, attack.startedAtTick)) {
    deactivateTrainingHitbox(enemy, runtime);
  }
}

function remainingTrainingHitboxTicks(tick: number, startedAtTick: number): number {
  return MELEE_HITBOX_TIMING.lastResolutionOffsetTicks - (tick - startedAtTick);
}

function deactivateTrainingHitbox(
  enemy: EnemySlot,
  runtime: TrainingAttackRuntime,
): void {
  delete runtime.active;
  enemy.animation = { state: "idle", ticksRemaining: 0 };
}

function beginTrainingAttack(
  sim: SimState,
  enemy: EnemySlot,
  itemId: string,
): ActiveMeleeAttack {
  const weapon = requiredWeapon(sim, itemId);
  return {
    startedAtTick: sim.tickCount,
    lastResolvedAtTick: Number.NEGATIVE_INFINITY,
    direction: { ...(enemy.entity.facing ?? { x: 0, y: 1 }) },
    profile: resolveWeaponProfile(weapon),
    sourceTags: [...weapon.tags],
    statusApplies: (weapon.weapon?.applies ?? []).map((apply) => ({ ...apply })),
    hasContactedHostile: true,
    contactedEntityIds: new Set(),
  };
}

function requiredWeapon(sim: SimState, itemId: string): ItemDef {
  const weapon = sim.content.items.get(itemId);
  if (!weapon?.weapon) throw new Error(`training dummy weapon ${itemId} is unavailable`);
  return weapon;
}

function resolvePlayerContacts(
  input: Pick<ActiveHitboxStep, "sim" | "enemy" | "effectEvents">,
  attack: ActiveMeleeAttack,
): void {
  const { sim, enemy, effectEvents } = input;
  for (const player of sim.players.values()) {
    if (!player.connected || !trainingHitboxTouches(enemy, attack, player.entity)) continue;
    resolveMeleeContact({ sim, attacker: enemy.entity, attack, victim: player.entity, effectEvents });
  }
}

function trainingHitboxTouches(
  enemy: EnemySlot,
  attack: ActiveMeleeAttack,
  target: EnemySlot["entity"],
): boolean {
  return weaponHitboxIntersectsHurtbox({
    attacker: enemy.entity,
    direction: attack.direction,
    profile: attack.profile,
    target,
  });
}
