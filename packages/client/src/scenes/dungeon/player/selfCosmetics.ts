// Local-only presentation state for the self player that the wire protocol doesn't
// carry: facing (the self snapshot has no faceX/faceY — only other players' entity
// snapshots do), a brief attack-swing pulse driven by the input controller's own swing
// cosmetic (timed to match the server's attack-anim window), the exact direction
// that swing was aimed at (so the melee wedge/weapon-sweep telegraph lines up with
// what was actually sent to the server via conn.attack(dx, dy), not a live mouse
// position that may have moved since the click), and the spawn-grace shield ring's
// countdown (panel round 4, LANE B — vfx/graceRing.ts owns the ring's fade math).
import type { Connection } from "../../../net/connection/connection.js";
import { SELF_GRACE_DURATION_MS } from "../../../vfx/overlays/status/graceRing.js";

export interface SelfCosmeticsState {
  faceX: number;
  faceY: number;
  /** Two-direction sprite facing changes only on horizontal input. */
  spriteFaceX: number;
  attackingUntilMs: number;
  attackDirX: number;
  attackDirY: number;
  /** Spawn-grace shield ring: absolute ms timestamp the ring finishes fading, 0 = inactive. */
  graceUntilMs: number;
}

export function createSelfCosmeticsState(): SelfCosmeticsState {
  return {
    faceX: 1,
    faceY: 0,
    spriteFaceX: 1,
    attackingUntilMs: 0,
    attackDirX: 1,
    attackDirY: 0,
    graceUntilMs: 0,
  };
}

/** Updates facing from the current move intent (holds the last facing while idle) and,
 * on any REAL movement/jump input, forfeits an active grace ring early — mirrors
 * spawnSafety.ts's own forfeit rule (neutral coasting between fixed steps does not
 * count), folded in here since both react to the exact same per-step move intent. */
export interface SelfMoveIntent {
  readonly moveX: number;
  readonly moveY: number;
  /** Canonical world-space aim/facing from the sampled input. Desktop pointer,
   * kid, and touch all populate this when they have a direction. */
  readonly faceX?: number | undefined;
  readonly faceY?: number | undefined;
  readonly jump?: boolean;
}

export function updateSelfFacing(state: SelfCosmeticsState, intent: SelfMoveIntent): void {
  const { moveX, moveY, jump = false } = intent;
  if (moveX !== 0 || moveY !== 0 || jump) endSelfGrace(state);
  const facing = inputFacing(intent);
  if (facing === undefined) return;
  state.faceX = facing.x;
  state.faceY = facing.y;
  if (facing.x !== 0) state.spriteFaceX = facing.x;
}

function inputFacing(intent: SelfMoveIntent): SelfAimFacing | undefined {
  if (hasFacing(intent)) return { x: intent.faceX, y: intent.faceY };
  if (intent.moveX === 0 && intent.moveY === 0) return undefined;
  return { x: intent.moveX, y: intent.moveY };
}

function hasFacing(intent: SelfMoveIntent): intent is SelfMoveIntent & {
  readonly faceX: number;
  readonly faceY: number;
} {
  return intent.faceX !== undefined && intent.faceY !== undefined &&
    (intent.faceX !== 0 || intent.faceY !== 0);
}

/** Matches the melee wedge and server contact window: 0 through 150 ms inclusive. */
const SELF_ATTACK_PULSE_MS = 160;

/** Call from the input controller's onSwing hook: starts the self attack telegraph, aimed at (dirX, dirY). */
export interface SelfAttackIntent {
  readonly nowMs: number;
  readonly dirX: number;
  readonly dirY: number;
}

export function triggerSelfAttack(state: SelfCosmeticsState, intent: SelfAttackIntent): void {
  const { nowMs, dirX, dirY } = intent;
  state.attackingUntilMs = nowMs + SELF_ATTACK_PULSE_MS;
  state.attackDirX = dirX;
  state.attackDirY = dirY;
}

export function isSelfAttacking(state: SelfCosmeticsState, nowMs: number): boolean {
  return nowMs < state.attackingUntilMs;
}

export interface SelfAimFacing {
  readonly x: number;
  readonly y: number;
}

/** Assisted modes follow movement while idle, then the captured assisted target
 * for the short attack pulse. Desktop mouse aim remains outside this state. */
export function assistedSelfAimFacing(
  state: SelfCosmeticsState,
  nowMs: number,
): SelfAimFacing {
  if (isSelfAttacking(state, nowMs)) {
    return { x: state.attackDirX, y: state.attackDirY };
  }
  return { x: state.faceX, y: state.faceY };
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
