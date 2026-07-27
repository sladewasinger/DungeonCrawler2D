/**
 * Content ids the client treats as a "boss" entity — drives the boss HP bar (Epic
 * 7.14's arena widget) and the boss-down celebration. ASSUMPTION (docs/ASSUMPTIONS.md
 * #12x): "warden-of-five" mirrors enemies.json's existing kebab-case ids (slime,
 * plant-creeper, spitter…), but the content lane hasn't landed The Warden of Five's
 * def yet — this id must match whatever it ships as, or the boss presentation never
 * triggers. A one-line fix once that def exists under a different id.
 */
export const BOSS_DEF_IDS: ReadonlySet<string> = new Set(["warden-of-five"]);

export function isBossDefId(defId: string | undefined): boolean {
  return !!defId && BOSS_DEF_IDS.has(defId);
}
