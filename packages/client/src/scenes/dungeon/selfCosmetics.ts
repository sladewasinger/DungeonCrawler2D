// Local-only presentation state for the self player that the wire protocol doesn't
// carry: facing (the self snapshot has no faceX/faceY — only other players' entity
// snapshots do), a brief attack-swing pulse driven by the input controller's own swing
// cosmetic (timed to match the server's attack-anim window), the exact direction
// that swing was aimed at (so the melee wedge/weapon-sweep telegraph lines up with
// what was actually sent to the server via conn.attack(dx, dy), not a live mouse
// position that may have moved since the click), and the spawn-grace shield ring's
// countdown (panel round 4, LANE B — vfx/graceRing.ts owns the ring's fade math).
import type { Connection } from "../../net/connection.js";
import { SELF_GRACE_DURATION_MS } from "../../vfx/graceRing.js";

export interface SelfCosmeticsState {
  faceX: number;
  faceY: number;
  attackingUntilMs: number;
  attackDirX: number;
  attackDirY: number;
  /** Spawn-grace shield ring: absolute ms timestamp the ring finishes fading, 0 = inactive. */
  graceUntilMs: number;
}

export function createSelfCosmeticsState(): SelfCosmeticsState {
  return { faceX: 1, faceY: 0, attackingUntilMs: 0, attackDirX: 1, attackDirY: 0, graceUntilMs: 0 };
}

/** Updates facing from the current move intent (holds the last facing while idle) and,
 * on any REAL movement/jump input, forfeits an active grace ring early — mirrors
 * spawnSafety.ts's own forfeit rule (neutral coasting between fixed steps does not
 * count), folded in here since both react to the exact same per-step move intent. */
export function updateSelfFacing(state: SelfCosmeticsState, moveX: number, moveY: number, jump = false): void {
  if (moveX !== 0 || moveY !== 0 || jump) endSelfGrace(state);
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

/** Starts (or restarts) the shield-ring countdown from now. */
export function startSelfGrace(state: SelfCosmeticsState, nowMs: number): void {
  state.graceUntilMs = nowMs + SELF_GRACE_DURATION_MS;
}

/** Forfeits the grace ring early — mirrors spawnSafety.ts's endSpawnGrace triggers
 * (real movement/jump input, or any offensive action): called from the same input
 * edges the server uses so the ring can't outlive the real invulnerability window. */
export function endSelfGrace(state: SelfCosmeticsState): void {
  state.graceUntilMs = 0;
}

/** Consumes a detected respawn handoff (net/apply.ts's justRespawned doc comment,
 * hp climbing back from <=0) into the local shield-ring countdown — call once per
 * frame from the scene update loop. */
export function consumeRespawnGrace(conn: Connection, state: SelfCosmeticsState, nowMs: number): void {
  if (!conn.justRespawned) return;
  conn.justRespawned = false;
  startSelfGrace(state, nowMs);
}
