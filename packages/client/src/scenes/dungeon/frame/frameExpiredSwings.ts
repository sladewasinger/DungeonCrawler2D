import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { resolveWeaponProfile } from "@dc2d/engine";
import { collectExpiredSwingsInto } from "../../../vfx/combat/melee/meleeConnect.js";
import type { FrameSyncContext } from "./frameSync.js";

export function syncExpiredWhiffs(
  { state, nowMs, vfx }: FrameSyncContext,
): void {
  const expired = collectExpiredSwingsInto(
    state.pendingSwings,
    nowMs,
    state.expiredSwings,
  );
  for (const swing of expired) {
    vfx.spawnMeleeWhiff({
      id: swing.attackerId,
      x: swing.worldX,
      y: swing.worldY,
      z: swing.z,
      angleRad: swing.angleRad,
      depth: swing.depth,
      tilePx: SCREEN_TILE_PX,
      nowMs,
      profile: swing.profile ?? resolveWeaponProfile(),
    });
  }
}
