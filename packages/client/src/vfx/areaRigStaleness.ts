// Pure staleness check for AreaEffectPool's per-id rig cache (wave-4 find #62,
// docs/ASSUMPTIONS.md): a tile's id ("x,y", scenes/dungeon/areaViews.ts) is stable for
// as long as ANY area occupies that tile, but the defId/sprite occupying it can change
// in place — oil catching fire, or fire+wet meeting and becoming steam. Split out of
// areaEffectPool.ts so this one decision is testable without a Phaser scene.
import type { AreaSpriteKind } from "./areaEffectPool.js";

/** True when the cached rig's sprite no longer matches the tile's current sprite (or
 * there is no cached rig yet) — the id alone is never enough to know the rig is still valid. */
export function rigIsStale(cachedSprite: AreaSpriteKind | undefined, currentSprite: AreaSpriteKind): boolean {
  return cachedSprite !== currentSprite;
}
