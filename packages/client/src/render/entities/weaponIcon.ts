// Held-weapon icon lookup: items.json has no sprite/icon field (out of this wave's one
// owned content change — only enemies.json's sprite ids were remapped), so this is a
// small static map from weapon item id to its atlas equip-hand icon frame.
const WEAPON_ICON_FRAMES: Readonly<Record<string, string>> = {
  knife: "weapon_knife",
  sword: "weapon_rusty_sword",
  hammer: "weapon_hammer",
};

/** The equip-hand icon frame for a weapon item id, or null for fists / unarmed / no icon mapped. */
export function weaponIconFrame(weaponId: string | null): string | null {
  if (!weaponId) return null;
  return WEAPON_ICON_FRAMES[weaponId] ?? null;
}

/**
 * Unarmed stand-in for the self player's orbiting weapon: the 0x72 pack ships no bare-
 * hand/fist/gauntlet icon (heroes only ever hold a weapon in its source art), so the
 * smallest weapon silhouette (a plain knife) doubles as one, tinted a skin tone by
 * heldWeapon.ts so it reads as a fist/knuckle, not a real blade. It remains self-only;
 * remote players with a null replicated weapon render empty-handed.
 */
export const FIST_FALLBACK_FRAME = "weapon_knife";
