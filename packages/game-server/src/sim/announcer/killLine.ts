// Turns an enemy's content-authored death epithet ("dissolved by a slime.
// A slime.") into an active-voice phrase credited to whoever just killed
// it ("Dissolved a slime. A slime.") — the killer-addressed personal kill
// line (Epic 7.13 book-fan lane, panel round 2 BOOKFAN).
import type { EnemyDef } from "@dc2d/engine";

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Most epithets read as a passive "<verb> by <clause>" (the enemy did
 * this TO a player); flipping just the verb into active voice reads as
 * the reverse: the player did it to the enemy. Epithets without a "by"
 * clause (e.g. spitter's "spat on from a safe, professional distance")
 * fall back to a generic opener naming the species. Trailing period is
 * stripped either way — PERSONAL_KILL_LINES supplies its own.
 */
export function killVerbPhrase(def: EnemyDef): string {
  const epithet = def.epithet;
  if (!epithet) return `Defeated a ${def.name.toLowerCase()}`;
  const passive = /^(\S+) by (.+)$/i.exec(epithet);
  // Both capture groups are non-optional in the pattern, so a match always
  // populates them — the `!`s just satisfy TS's regex-exec-result typing.
  const phrase = passive
    ? `${capitalize(passive[1]!)} ${passive[2]!}`
    : `Defeated a ${def.name.toLowerCase()}. ${capitalize(epithet)}`;
  return phrase.replace(/\.+$/, "");
}
