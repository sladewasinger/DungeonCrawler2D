// Local-only presentation state for the self player that the wire protocol doesn't
// carry: facing (the self snapshot has no faceX/faceY — only other players' entity
// snapshots do), a brief attack-swing pulse driven by the input controller's own swing
// cosmetic (timed to match the server's attack-anim window), and the exact direction
// that swing was aimed at — so the melee wedge/weapon-sweep telegraph lines up with
// what was actually sent to the server via conn.attack(dx, dy), not a live mouse
// position that may have moved since the click.
export interface SelfCosmeticsState {
  faceX: number;
  faceY: number;
  attackingUntilMs: number;
  attackDirX: number;
  attackDirY: number;
}

export function createSelfCosmeticsState(): SelfCosmeticsState {
  return { faceX: 1, faceY: 0, attackingUntilMs: 0, attackDirX: 1, attackDirY: 0 };
}

/** Updates facing from the current move intent; holds the last facing while idle. */
export function updateSelfFacing(state: SelfCosmeticsState, moveX: number, moveY: number): void {
  if (moveX === 0 && moveY === 0) return;
  state.faceX = moveX;
  state.faceY = moveY;
}

/** 3 ticks @ 20Hz — matches game-server/sim/snapshots.ts's playerFields attack-anim window. */
const SELF_ATTACK_PULSE_MS = 150;

/** Call from the input controller's onSwing hook: starts the self attack telegraph, aimed at (dirX, dirY). */
export function triggerSelfAttack(state: SelfCosmeticsState, nowMs: number, dirX: number, dirY: number): void {
  state.attackingUntilMs = nowMs + SELF_ATTACK_PULSE_MS;
  state.attackDirX = dirX;
  state.attackDirY = dirY;
}

export function isSelfAttacking(state: SelfCosmeticsState, nowMs: number): boolean {
  return nowMs < state.attackingUntilMs;
}
