// Pure cache-validity rule for AreaEffectPool rigs, keeping Phaser-free replacement
// behavior verifiable when a stable tile id receives a different content effect.
import type { AreaSpriteKind } from "./areaEffectPool.js";

/** True when a cached rig was built for a different visual recipe or content effect. */
export function rigIsStale(
  cachedSprite: AreaSpriteKind | undefined,
  cachedEffectId: string | undefined,
  currentSprite: AreaSpriteKind,
  currentEffectId: string,
): boolean {
  return cachedSprite !== currentSprite || cachedEffectId !== currentEffectId;
}
