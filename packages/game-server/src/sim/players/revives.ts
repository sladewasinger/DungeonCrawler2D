import {
  DOWNED_DURATION,
  INTERACT_RANGE,
  REVIVE_HOLD_TICKS,
  REVIVE_HP_FRACTION,
  TICK_RATE,
  type EffectEvent,
} from "@dc2d/engine";
import type { PlayerSlot, ReviveAttempt, SimState } from "../state/state.js";

const MOVEMENT_EPSILON = 0.05;

function inRange(a: PlayerSlot, b: PlayerSlot): boolean {
  return Math.hypot(
    a.entity.body.x - b.entity.body.x,
    a.entity.body.y - b.entity.body.y,
  ) <= INTERACT_RANGE;
}

function attemptIsValid(sim: SimState, attempt: ReviveAttempt): boolean {
  const rescuer = sim.players.get(attempt.rescuerId);
  const target = sim.players.get(attempt.targetId);
  if (!rescuer || !target) return false;
  return rescuerCanRevive(rescuer) && targetCanBeRevived(sim, target) &&
    inRange(rescuer, target) && rescuerStayedStill(rescuer, attempt);
}

function rescuerCanRevive(slot: PlayerSlot): boolean {
  return slot.connected && slot.entity.hp > 0 && slot.downedAtTick === null;
}

function targetCanBeRevived(sim: SimState, slot: PlayerSlot): boolean {
  return slot.connected && slot.downedAtTick !== null &&
    sim.tickCount - slot.downedAtTick < DOWNED_DURATION * TICK_RATE;
}

function rescuerStayedStill(rescuer: PlayerSlot, attempt: ReviveAttempt): boolean {
  return Math.hypot(rescuer.entity.body.x - attempt.startX, rescuer.entity.body.y - attempt.startY) <= MOVEMENT_EPSILON;
}

function targetAlreadyClaimed(sim: SimState, rescuerId: string, targetId: string): boolean {
  for (const attempt of sim.reviveAttempts.values()) {
    if (attempt.rescuerId !== rescuerId && attempt.targetId === targetId) return true;
  }
  return false;
}

interface ReviveHeldRequest {
  sim: SimState;
  rescuer: PlayerSlot;
  targetId: string;
  held: boolean;
}

export function setReviveHeld({ sim, rescuer, targetId, held }: ReviveHeldRequest): void {
  if (!held) {
    clearMatchingAttempt(sim, rescuer.entity.id, targetId);
    return;
  }
  if (targetAlreadyClaimed(sim, rescuer.entity.id, targetId)) return;
  const target = sim.players.get(targetId);
  if (!target || target === rescuer || !inRange(rescuer, target)) return;
  const attempt: ReviveAttempt = {
    rescuerId: rescuer.entity.id,
    targetId,
    startedAtTick: sim.tickCount,
    startX: rescuer.entity.body.x,
    startY: rescuer.entity.body.y,
  };
  if (!attemptIsValid(sim, attempt)) return;
  sim.reviveAttempts.set(rescuer.entity.id, attempt);
}

function clearMatchingAttempt(sim: SimState, rescuerId: string, targetId: string): void {
  if (sim.reviveAttempts.get(rescuerId)?.targetId === targetId) sim.reviveAttempts.delete(rescuerId);
}

function completeRevive(
  sim: SimState,
  attempt: ReviveAttempt,
  effectEvents: EffectEvent[],
): void {
  const rescuer = sim.players.get(attempt.rescuerId);
  const target = sim.players.get(attempt.targetId);
  if (!rescuer || !target) return;
  target.downedAtTick = null;
  delete target.entity.downedUntil;
  target.entity.hp = Math.max(1, Math.round(target.entity.maxHp * REVIVE_HP_FRACTION));
  target.outbox.push({ t: "toast", msg: `${rescuer.entity.name} got you back up!` });
  rescuer.outbox.push({ t: "toast", msg: `You revived ${target.entity.name}` });
  effectEvents.push({ t: "hp", id: target.entity.id, delta: target.entity.hp, hp: target.entity.hp });
  for (const [rescuerId, active] of sim.reviveAttempts) {
    if (active.targetId === target.entity.id) sim.reviveAttempts.delete(rescuerId);
  }
}

export function stepRevives(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const [rescuerId, attempt] of sim.reviveAttempts) {
    if (!attemptIsValid(sim, attempt)) {
      sim.reviveAttempts.delete(rescuerId);
      continue;
    }
    if (sim.tickCount - attempt.startedAtTick >= REVIVE_HOLD_TICKS) {
      completeRevive(sim, attempt, effectEvents);
    }
  }
}
