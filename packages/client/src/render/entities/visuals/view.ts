// Per-frame input contracts for the entity renderer: shaped to mirror
// @dc2d/engine's EntitySnapshot/EnemyAnimationState fields 1:1 so wiring a real
// net.apply()-derived list in later waves is a passthrough, not a rewrite.
import type { EnemyAnimationState, PlayerSkin, WorldView } from "@dc2d/engine";

export interface RenderContext {
  world: WorldView;
  nowMs: number;
  dtSeconds: number;
  selfX: number;
  selfY: number;
  partyIds: ReadonlySet<string>;
}

export interface PlayerEntityView {
  id: string;
  playerId: string;
  skin?: PlayerSkin;
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  fx: readonly string[];
  faceX: number;
  faceY: number;
  air: boolean;
  downed: boolean;
  /** Authoritative 0..1 hold progress while this crawler is being revived. */
  reviveProgress?: number;
  disconnected?: boolean;
  attacking: boolean;
  blocking: boolean;
  weaponId: string | null;
  /** Self-only live weapon-orbit target. Remote players use replicated facing instead. */
  weaponAimAngle: number | null;
  /** Self-only marker: body and weapon presentation follow movement/assisted attacks. */
  assistedAim?: boolean;
  /** Direction (radians) of the current/most-recent swing: self's real attack.dx/dy for
   * exact wedge/sweep alignment, or a remote player's reported faceX/faceY as the best
   * available proxy (the protocol never reports a remote player's actual swing direction). */
  attackAngleRad: number;
}

export interface MonsterEntityView {
  id: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  fx: readonly string[];
  anim: EnemyAnimationState;
  faceX: number;
  air: boolean;
}

export type PetAnimationState = "idle" | "walk";

export interface PetEntityView {
  id: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  anim: PetAnimationState;
  faceX: number;
  air: boolean;
  ownerName?: string;
}

export interface ItemEntityView {
  id: string;
  x: number;
  y: number;
  z: number;
  frame: string;
  lootLabel?: string;
  lootKillerName?: string;
  lootLockSeconds?: number;
  lootNearby?: boolean;
}

export interface ProjectileEntityView {
  id: string;
  x: number;
  y: number;
  frame: string;
  vx: number;
  vy: number;
}

export interface TorchEntityView {
  id: string;
  x: number;
  y: number;
  z: number;
  air: boolean;
  state: "flying" | "placed";
  frame: string;
  vx: number;
  vy: number;
}
