// Local-only presentation state for the self player that the wire protocol doesn't
// carry: facing (the self snapshot has no faceX/faceY — only other players' entity
// snapshots do) and a brief attack-swing pulse driven by the input controller's own
// swing cosmetic, timed to match the server's attack-anim window.
export interface SelfCosmeticsState {
  faceX: number;
  faceY: number;
  attackingUntilMs: number;
}

export function createSelfCosmeticsState(): SelfCosmeticsState {
  return { faceX: 1, faceY: 0, attackingUntilMs: 0 };
}

/** Updates facing from the current move intent; holds the last facing while idle. */
export function updateSelfFacing(state: SelfCosmeticsState, moveX: number, moveY: number): void {
  if (moveX === 0 && moveY === 0) return;
  state.faceX = moveX;
  state.faceY = moveY;
}

/** 3 ticks @ 20Hz — matches game-server/sim/snapshots.ts's playerFields attack-anim window. */
const SELF_ATTACK_PULSE_MS = 150;

/** Call from the input controller's onSwing hook: starts the self attack telegraph. */
export function triggerSelfAttack(state: SelfCosmeticsState, nowMs: number): void {
  state.attackingUntilMs = nowMs + SELF_ATTACK_PULSE_MS;
}

export function isSelfAttacking(state: SelfCosmeticsState, nowMs: number): boolean {
  return nowMs < state.attackingUntilMs;
}
