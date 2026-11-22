import {
  ARMOR_SLOTS,
  MOVE_SPEED,
  emptyArmorLoadout,
  playerMaxHpForLevel,
  playerMaxStaminaForLevel,
  type ArmorLoadout,
  type ArmorSlot,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";

export interface DerivedArmorStats {
  readonly damageReduction: number;
  readonly maxHpBonus: number;
  readonly moveSpeedBonus: number;
}

export function ensureSlotArmor(slot: PlayerSlot): ArmorLoadout {
  slot.armor ??= emptyArmorLoadout();
  return slot.armor;
}

export function armorStatsFor(sim: SimState, slot: PlayerSlot): DerivedArmorStats {
  const armor = slot.armor;
  if (!armor) return { damageReduction: 0, maxHpBonus: 0, moveSpeedBonus: 0 };
  let damageReduction = 0;
  let maxHpBonus = 0;
  let moveSpeedBonus = 0;
  for (const key of ARMOR_SLOTS) {
    const itemId = armor[key];
    const def = itemId ? sim.content.items.get(itemId)?.armor : undefined;
    if (!def) continue;
    damageReduction += def.damageReduction;
    maxHpBonus += def.maxHpBonus ?? 0;
    moveSpeedBonus += def.moveSpeedBonus ?? 0;
  }
  return {
    damageReduction: Math.min(0.75, damageReduction),
    maxHpBonus,
    moveSpeedBonus,
  };
}

export function syncPlayerDerivedStats(
  sim: SimState,
  slot: PlayerSlot,
  healBonusDelta = false,
): void {
  const level = slot.stored.level ?? 1;
  const stats = armorStatsFor(sim, slot);
  syncPlayerHealthCap(slot, playerMaxHpForLevel(level, stats.maxHpBonus), healBonusDelta);
  syncPlayerStaminaCap(slot, playerMaxStaminaForLevel(level), healBonusDelta);
  slot.entity.baseSpeed = MOVE_SPEED * (1 + stats.moveSpeedBonus);
}

function syncPlayerHealthCap(slot: PlayerSlot, nextMaxHp: number, healBonusDelta: boolean): void {
  const prevMaxHp = slot.entity.maxHp;
  slot.entity.maxHp = nextMaxHp;
  if (healBonusDelta && nextMaxHp > prevMaxHp && slot.entity.hp > 0) {
    slot.entity.hp = Math.min(nextMaxHp, slot.entity.hp + (nextMaxHp - prevMaxHp));
  } else if (slot.entity.hp > nextMaxHp) {
    slot.entity.hp = nextMaxHp;
  }
}

function syncPlayerStaminaCap(slot: PlayerSlot, nextMaxStamina: number, healBonusDelta: boolean): void {
  const prevMaxStamina = slot.maxStamina ?? playerMaxStaminaForLevel(1);
  slot.maxStamina = nextMaxStamina;
  if (slot.stamina === undefined) return;
  const delta = healBonusDelta ? Math.max(0, nextMaxStamina - prevMaxStamina) : 0;
  slot.stamina = Math.min(nextMaxStamina, slot.stamina + delta);
}

export function clearUnequippedArmorItem(
  sim: SimState,
  slot: PlayerSlot,
  itemId: string,
): void {
  const armor = slot.armor;
  if (!armor) return;
  let changed = false;
  for (const key of ARMOR_SLOTS) {
    if (armor[key] === itemId) {
      armor[key] = null;
      changed = true;
    }
  }
  if (changed) syncPlayerDerivedStats(sim, slot);
}

export function clearAllArmor(sim: SimState, slot: PlayerSlot): void {
  slot.armor = emptyArmorLoadout();
  syncPlayerDerivedStats(sim, slot);
}

export function setArmorSlot(
  sim: SimState,
  slot: PlayerSlot,
  options: { armorSlot: ArmorSlot; itemId: string | null },
): void {
  const armor = ensureSlotArmor(slot);
  armor[options.armorSlot] = options.itemId;
  syncPlayerDerivedStats(sim, slot, true);
}
