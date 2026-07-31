// Held-weapon icon lookup: items.json has no sprite/icon field (out of this wave's one
// owned content change — only enemies.json's sprite ids were remapped), so this is a
// small static map from weapon item id to its atlas equip-hand icon frame.
export const HAMMER_WEAPON_FRAME = "weapon_hammer";

const WEAPON_ICON_FRAMES: Readonly<Record<string, string>> = {
  knife: "weapon_knife",
  sword: "weapon_rusty_sword",
  hammer: HAMMER_WEAPON_FRAME,
};

/** The equip-hand icon frame for a weapon item id, or null for fists / unarmed / no icon mapped. */
export function weaponIconFrame(weaponId: string | null): string | null {
  if (!weaponId) return null;
  return WEAPON_ICON_FRAMES[weaponId] ?? null;
}

/**
 * Unarmed stand-in for every player's orbiting weapon: a compact round atlas particle
 * tinted to skin tone by heldWeapon.ts. It reads as a fist without borrowing a blade
 * silhouette while preserving aim and block readability for remote observers.
 */
export const FIST_FALLBACK_FRAME = "particle_soft";
