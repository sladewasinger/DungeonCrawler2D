// Pure cache-validity rule for AreaEffectPool rigs, keeping Phaser-free replacement
// behavior verifiable when a stable tile id receives a different content effect.
import type { AreaSpriteKind } from "./areaEffectPool.js";

/** True when a cached rig was built for a different visual recipe or content effect. */
export interface AreaRigIdentity {
  readonly sprite: AreaSpriteKind;
  readonly effectId: string;
}

export function rigIsStale(
  cached: AreaRigIdentity | undefined,
  current: AreaRigIdentity,
): boolean {
  return cached?.sprite !== current.sprite || cached.effectId !== current.effectId;
}
