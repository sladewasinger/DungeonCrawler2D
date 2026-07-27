import type { PlayerSlot, SimState } from "../state/state.js";
import { invAdd, invQty } from "./inventory.js";

const STARTER_SWORD_DEF = "sword";
const STARTER_TORCH_DEF = "torch";
const STARTER_BANDAGE_DEF = "bandage";
const STARTER_TORCH_QTY = 3;
const STARTER_BANDAGE_QTY = 2;
const STARTER_HOTBAR_SCHEMA = 1;

export function ensureStarterKit(sim: SimState, slot: PlayerSlot): void {
  if (lacksStarterKit(slot)) grantStarterItems(sim, slot);
  migrateStarterItems(sim, slot);
}

export function grantRespawnKit(sim: SimState, slot: PlayerSlot): void {
  grantMissingStarterItems(sim, slot);
  if (slot.weapon === null) slot.weapon = STARTER_SWORD_DEF;
}

function lacksStarterKit(slot: PlayerSlot): boolean {
  if (slot.weapon !== null) return false;
  if (invQty(slot, STARTER_SWORD_DEF) > 0 || invQty(slot, STARTER_TORCH_DEF) > 0) return false;
  return !slot.stored.stash.some(hasStarterItem);
}

function hasStarterItem(entry: { item: string }): boolean {
  return entry.item === STARTER_SWORD_DEF || entry.item === STARTER_TORCH_DEF;
}

function grantStarterItems(sim: SimState, slot: PlayerSlot): void {
  invAdd(sim, slot, STARTER_SWORD_DEF, 1);
  invAdd(sim, slot, STARTER_TORCH_DEF, STARTER_TORCH_QTY);
  grantMissingBandages(sim, slot);
}

function grantMissingStarterItems(sim: SimState, slot: PlayerSlot): void {
  if (invQty(slot, STARTER_SWORD_DEF) === 0) invAdd(sim, slot, STARTER_SWORD_DEF, 1);
  if (invQty(slot, STARTER_TORCH_DEF) === 0) invAdd(sim, slot, STARTER_TORCH_DEF, STARTER_TORCH_QTY);
  grantMissingBandages(sim, slot);
}

function grantMissingBandages(sim: SimState, slot: PlayerSlot): void {
  if (invQty(slot, STARTER_BANDAGE_DEF) === 0) invAdd(sim, slot, STARTER_BANDAGE_DEF, STARTER_BANDAGE_QTY);
}

function migrateStarterItems(sim: SimState, slot: PlayerSlot): void {
  if ((slot.stored.starterHotbarSchema ?? 0) >= STARTER_HOTBAR_SCHEMA) return;
  grantMissingBandages(sim, slot);
  slot.hotbar[0] = STARTER_TORCH_DEF;
  slot.hotbar[1] = STARTER_BANDAGE_DEF;
  sim.store.recordHotbar(slot.stored, slot.hotbar, STARTER_HOTBAR_SCHEMA);
}
