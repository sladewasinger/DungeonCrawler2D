// Enemy-blood tint lookup: default blood-red per VISUAL_DIRECTION's damage accent
// (`#e04a4a`), overridden only where content data clearly reads as a different
// substance — today just the slime, whose ooze is its defining trait (ASSUMPTIONS.md
// #56). Keeps the palette closed: reuses the existing poison-green accent rather than
// inventing a new hue, per VISUAL_DIRECTION's "no new hues without updating this doc".

const BLOOD_RED = 0xe04a4a;
const SLIME_GREEN = 0x7bd44a;

/** enemy defId -> its splatter/decal tint override; anything unmapped (including players) uses blood-red. */
const ENEMY_TINTS: Readonly<Record<string, number>> = {
  slime: SLIME_GREEN,
};

/** Maps a hit/death target's enemy defId (undefined for players) to its blood tint. */
export function bloodTintFor(defId: string | undefined): number {
  if (defId === undefined) return BLOOD_RED;
  return ENEMY_TINTS[defId] ?? BLOOD_RED;
}
