// Per-frame input contracts for the entity renderer: shaped to mirror
// @dc2d/engine's EntitySnapshot/EnemyAnimationState fields 1:1 so wiring a real
// net.apply()-derived list in later waves is a passthrough, not a rewrite.
import type { EnemyAnimationState, WorldView } from "@dc2d/engine";

export interface RenderContext {
  readonly world: WorldView;
  readonly nowMs: number;
  readonly dtSeconds: number;
  readonly selfX: number;
  readonly selfY: number;
  readonly partyIds: ReadonlySet<string>;
}

export interface PlayerEntityView {
  readonly id: string;
  readonly playerId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly fx: readonly string[];
  readonly faceX: number;
  readonly faceY: number;
  readonly air: boolean;
  readonly downed: boolean;
  readonly attacking: boolean;
  readonly weaponId: string | null;
  /** Self-only live weapon-orbit target. Remote players use replicated facing instead. */
  readonly weaponAimAngle: number | null;
  /** Direction (radians) of the current/most-recent swing: self's real attack.dx/dy for
   * exact wedge/sweep alignment, or a remote player's reported faceX/faceY as the best
   * available proxy (the protocol never reports a remote player's actual swing direction). */
  readonly attackAngleRad: number;
}

export interface MonsterEntityView {
  readonly id: string;
  readonly defId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly fx: readonly string[];
  readonly anim: EnemyAnimationState;
  readonly faceX: number;
  readonly air: boolean;
}

export interface ItemEntityView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly frame: string;
}

export interface ProjectileEntityView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly frame: string;
  readonly vx: number;
  readonly vy: number;
}

export interface TorchEntityView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly air: boolean;
  readonly state: "flying" | "placed";
  readonly frame: string;
  readonly vx: number;
  readonly vy: number;
}
