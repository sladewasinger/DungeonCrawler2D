import type { PlayerVisual } from "../../visuals/state.js";

export interface AttackCooldownState {
  readonly ready: boolean;
  readonly progress: number;
  readonly remainingMs: number;
}

interface CooldownRecord {
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly readyFlash: AttackReadyFlashTracker;
}

export const ATTACK_READY_FLASH_DURATION_MS = 120;

export interface AttackReadyFlashTracker {
  acknowledged: boolean;
  startedAtMs: number | undefined;
}

const cooldowns = new WeakMap<PlayerVisual, CooldownRecord>();

export function attackCooldownState(
  startedAtMs: number | undefined,
  durationMs: number,
  nowMs: number,
): AttackCooldownState {
  if (startedAtMs === undefined || durationMs <= 0) return readyState();
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const progress = Math.min(1, elapsedMs / durationMs);
  return {
    ready: elapsedMs >= durationMs,
    progress,
    remainingMs: Math.max(0, durationMs - elapsedMs),
  };
}

export function recordAttackStart(
  visual: PlayerVisual,
  startedAtMs: number,
  durationMs: number,
): void {
  cooldowns.set(visual, {
    startedAtMs,
    durationMs,
    readyFlash: { acknowledged: false, startedAtMs: undefined },
  });
}

export function cooldownForVisual(
  visual: PlayerVisual,
  nowMs: number,
): AttackCooldownState {
  const record = cooldowns.get(visual);
  return attackCooldownState(record?.startedAtMs, record?.durationMs ?? 0, nowMs);
}

export interface AttackReadyFlashVisualInput {
  readonly visual: PlayerVisual;
  readonly state: AttackCooldownState;
  readonly nowMs: number;
  readonly downed: boolean;
}

export function attackReadyFlashForVisual(
  input: AttackReadyFlashVisualInput,
): boolean {
  const record = cooldowns.get(input.visual);
  if (!record) return false;
  return stepAttackReadyFlash({
    tracker: record.readyFlash,
    state: input.state,
    nowMs: input.nowMs,
    downed: input.downed,
  });
}

export interface AttackReadyFlashStep {
  readonly tracker: AttackReadyFlashTracker;
  readonly state: AttackCooldownState;
  readonly nowMs: number;
  readonly downed: boolean;
}

export function stepAttackReadyFlash(input: AttackReadyFlashStep): boolean {
  const { tracker, state, nowMs } = input;
  if (input.downed) {
    tracker.acknowledged ||= state.ready;
    tracker.startedAtMs = undefined;
    return false;
  }
  if (!state.ready) return false;
  startReadyFlashOnce(tracker, nowMs);
  if (tracker.startedAtMs === undefined) return false;
  return nowMs - tracker.startedAtMs < ATTACK_READY_FLASH_DURATION_MS;
}

function startReadyFlashOnce(
  tracker: AttackReadyFlashTracker,
  nowMs: number,
): void {
  if (tracker.acknowledged) return;
  tracker.acknowledged = true;
  tracker.startedAtMs = nowMs;
}

function readyState(): AttackCooldownState {
  return { ready: true, progress: 1, remainingMs: 0 };
}
