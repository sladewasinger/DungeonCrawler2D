/** Player survival buff progression (Well-Fed & hearth-warmed Rested) and persistence hydration helpers. */
import { SURVIVAL_BUFF_TUNING, computeSurvivalRegen, cloneInventoryState, sanitizeCharacterAppearance } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import type { PersistedPlayerRecord, PersistedWorldFile } from "./persistenceStore.js";

function updateHearthWarmth(c: CombatPlayerRef["combat"], nearCampfire: boolean, dt: number): void {
  if (!nearCampfire || c.hitTimer > 0) { c.hearthWarmSec = Math.max(0, c.hearthWarmSec - dt * 2); return; }
  c.hearthWarmSec += dt;
  if (c.hearthWarmSec >= SURVIVAL_BUFF_TUNING.restedChargeSec) {
    c.restedTimer = Math.max(c.restedTimer, SURVIVAL_BUFF_TUNING.restedDurationSec);
  }
}

export function stepPlayerSurvivalBuffs(opts: {
  readonly p: CombatPlayerRef; readonly nearCampfire: boolean; readonly dt: number;
}): void {
  const c = opts.p.combat;
  c.wellFedTimer = Math.max(0, c.wellFedTimer - opts.dt);
  c.restedTimer = Math.max(0, c.restedTimer - opts.dt);
  updateHearthWarmth(c, opts.nearCampfire, opts.dt);
  if (c.respawnTimer > 0) return;
  const regen = computeSurvivalRegen({ wellFedTimer: c.wellFedTimer, restedTimer: c.restedTimer, hitTimer: c.hitTimer });
  if (regen.hpPerSec > 0) c.hp = Math.min(c.maxHp, c.hp + regen.hpPerSec * opts.dt);
  if (regen.staminaBonusPerSec > 0 && c.swingTimer <= 0 && c.dodgeTimer <= 0) {
    c.stamina = Math.min(c.maxStamina, c.stamina + regen.staminaBonusPerSec * opts.dt);
  }
}

export function applySavedPlayerRecord(p: CombatPlayerRef & { x: number; y: number; elevation: number; appearance: PersistedPlayerRecord["appearance"] }, rec: PersistedPlayerRecord): void {
  p.x = rec.x;
  p.y = rec.y;
  p.elevation = rec.elevation;
  p.appearance = sanitizeCharacterAppearance(rec.appearance);
  p.inventory = cloneInventoryState(rec.inventory);
  p.combat.wellFedTimer = rec.wellFedTimer ?? 0;
  p.combat.restedTimer = rec.restedTimer ?? 0;
}

export function buildPersistedPlayerList(opts: {
  readonly activePlayers: Iterable<{ readonly name: string; readonly x: number; readonly y: number; readonly elevation: number; readonly appearance: PersistedPlayerRecord["appearance"]; readonly inventory: PersistedPlayerRecord["inventory"]; readonly combat: CombatPlayerRef["combat"] }>;
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly normalizeName: (name: string) => string;
}): readonly PersistedPlayerRecord[] {
  for (const p of opts.activePlayers) {
    const key = opts.normalizeName(p.name);
    opts.savedProfiles.set(key, {
      ownerKey: key, x: p.x, y: p.y, elevation: p.elevation,
      appearance: p.appearance, inventory: cloneInventoryState(p.inventory),
      wellFedTimer: p.combat.wellFedTimer, restedTimer: p.combat.restedTimer,
    });
  }
  return Array.from(opts.savedProfiles.values());
}

export function indexSavedPlayers(file: PersistedWorldFile): Map<string, PersistedPlayerRecord> {
  const map = new Map<string, PersistedPlayerRecord>();
  for (const p of file.players) map.set(p.ownerKey, p);
  return map;
}
