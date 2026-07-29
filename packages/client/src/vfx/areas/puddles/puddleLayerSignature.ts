import type { AreaTileView } from "../areaEffectPool.js";
import type { PuddleKind } from "../presentation/areaVisualStyle.js";

export function puddleLayerSignature(
  tiles: readonly AreaTileView[],
  kind: PuddleKind,
  orientation: number,
): string {
  let hash = 2_166_136_261;
  let count = 0;
  for (const tile of tiles) {
    if (tile.sprite !== kind) continue;
    hash = hashText(hash, tile.id);
    hash = hashNumber(hash, tile.groundHeight);
    hash = Math.imul(hash ^ tile.neighborMask, 16_777_619);
    count++;
  }
  return `${orientation}:${count}:${hash >>> 0}`;
}

function hashNumber(initial: number, value: number): number {
  return Math.imul(initial ^ Math.round(value * 100), 16_777_619);
}

function hashText(initial: number, value: string): number {
  let hash = initial;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }
  return hash;
}
