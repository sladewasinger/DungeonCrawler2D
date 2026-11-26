/** Client-side inventory snapshot builders and local-preview fallback mutations. */
import { getItemDef, getRecipeDef, maxStackForItem, STARTER_ARMOR, STARTER_LOADOUT } from "@dc2d/content";
import {
  HOTBAR_SLOT_COUNT,
  cloneInventoryState,
  craftRecipeInState,
  createEmptyInventoryState,
  equipArmorFromSlot,
  moveOrSwapSlot,
  quickTransferChestSlot,
  removeFromSlot,
  takeAllFromChest,
  transferChestSlot,
  unequipArmorToSlot,
  type ArmorSlotKey,
  type ChatEntry,
  type DropItemRequest,
  type InventorySnapshot,
  type PlayerSnapshot,
  type WorldChestSnapshot,
} from "@dc2d/engine";

export function createStarterInventorySnapshot(): InventorySnapshot {
  const state = createEmptyInventoryState();
  for (const entry of STARTER_LOADOUT) {
    if (entry.slot >= 0 && entry.slot < state.slots.length) {
      state.slots[entry.slot] = { itemId: entry.itemId, count: entry.count };
    }
  }
  return { slots: state.slots, armor: { ...STARTER_ARMOR }, selectedHotbar: 0, nearCampfire: true, nearWorkbench: false };
}

export function applyMoveSlot(inv: InventorySnapshot, move: { readonly from: number; readonly to: number }): InventorySnapshot {
  const cloned = cloneInventoryState(inv);
  if (!moveOrSwapSlot(cloned.slots, move, maxStackForItem)) return inv;
  return { ...inv, slots: cloned.slots, armor: cloned.armor };
}

function withArmorResult(inv: InventorySnapshot, next: { readonly slots: InventorySnapshot["slots"]; readonly armor: InventorySnapshot["armor"]; readonly armorPrefixes?: InventorySnapshot["armorPrefixes"] }): InventorySnapshot {
  const out = { ...inv, slots: next.slots, armor: next.armor } as { -readonly [K in keyof InventorySnapshot]: InventorySnapshot[K] };
  if (next.armorPrefixes) out.armorPrefixes = next.armorPrefixes;
  else delete out.armorPrefixes;
  return out;
}

export function applyEquipArmor(
  inv: InventorySnapshot,
  req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined },
): InventorySnapshot {
  const next = equipArmorFromSlot(inv, req, getItemDef);
  return next ? withArmorResult(inv, next) : inv;
}

export function applyUnequipArmor(
  inv: InventorySnapshot,
  req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined },
): InventorySnapshot {
  const next = unequipArmorToSlot(inv, req, { maxStackFor: maxStackForItem, lookup: getItemDef });
  return next ? withArmorResult(inv, next) : inv;
}

export function applyCraftRecipe(inv: InventorySnapshot, recipeId: string): InventorySnapshot {
  const recipe = getRecipeDef(recipeId);
  if (!recipe) return inv;
  const next = craftRecipeInState(inv, {
    recipe, nearCampfire: inv.nearCampfire, nearWorkbench: inv.nearWorkbench ?? false, maxStackFor: maxStackForItem,
  });
  return next ? { ...inv, slots: next.slots, armor: next.armor } : inv;
}

export function applySelectHotbar(inv: InventorySnapshot, slot: number): InventorySnapshot {
  if (slot < 0 || slot >= HOTBAR_SLOT_COUNT) return inv;
  return { ...inv, selectedHotbar: slot };
}

export function heldItemForInventory(inv: InventorySnapshot): string | null {
  return inv.slots[inv.selectedHotbar]?.itemId ?? null;
}

export function findNearestChest(
  chests: readonly WorldChestSnapshot[],
  pos: { readonly x: number; readonly y: number },
  radius: number,
): WorldChestSnapshot | undefined {
  let best: WorldChestSnapshot | undefined;
  let bestDist = radius;
  for (const c of chests) {
    const d = Math.hypot(c.x - pos.x, c.y - pos.y);
    if (d <= bestDist) { bestDist = d; best = c; }
  }
  return best;
}

export function applyChestTransfer(opts: {
  readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot;
  readonly from: "chest" | "inv"; readonly fromSlot: number;
  readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined;
}): { readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot; readonly changed: boolean } {
  const nextSlots = opts.inv.slots.map((s) => (s ? { ...s } : null));
  const nextChestSlots = opts.chest.slots.map((s) => (s ? { ...s } : null));
  const changed = opts.quick
    ? quickTransferChestSlot({ chestSlots: nextChestSlots, invSlots: nextSlots, from: opts.from, slotIndex: opts.fromSlot, maxStackFor: maxStackForItem })
    : transferChestSlot({ chestSlots: nextChestSlots, invSlots: nextSlots, from: opts.from, fromSlot: opts.fromSlot, to: opts.to, toSlot: opts.toSlot, maxStackFor: maxStackForItem });
  if (!changed) return { inv: opts.inv, chest: opts.chest, changed: false };
  return { inv: { ...opts.inv, slots: nextSlots }, chest: { ...opts.chest, opened: true, slots: nextChestSlots }, changed: true };
}

export function applyChestTakeAll(opts: {
  readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot;
}): { readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot; readonly changed: boolean } {
  const nextSlots = opts.inv.slots.map((s) => (s ? { ...s } : null));
  const nextChestSlots = opts.chest.slots.map((s) => (s ? { ...s } : null));
  const moved = takeAllFromChest({ chestSlots: nextChestSlots, invSlots: nextSlots, maxStackFor: maxStackForItem });
  if (moved <= 0) return { inv: opts.inv, chest: opts.chest, changed: false };
  return { inv: { ...opts.inv, slots: nextSlots }, chest: { ...opts.chest, opened: true, slots: nextChestSlots }, changed: true };
}

function dropFromChestSlot(opts: { readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined; readonly req: DropItemRequest }) {
  if (!opts.chest || opts.req.slotIndex === undefined) return { inv: opts.inv, chest: opts.chest };
  const nextChest = opts.chest.slots.map((s) => (s ? { ...s } : null));
  if (!removeFromSlot(nextChest, opts.req.slotIndex, opts.req.count)) return { inv: opts.inv, chest: opts.chest };
  return { inv: opts.inv, chest: { ...opts.chest, opened: true, slots: nextChest } };
}

function dropFromInvSlot(opts: { readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined; readonly req: DropItemRequest }) {
  if (opts.req.slotIndex === undefined) return { inv: opts.inv, chest: opts.chest };
  const nextSlots = opts.inv.slots.map((s) => (s ? { ...s } : null));
  if (!removeFromSlot(nextSlots, opts.req.slotIndex, opts.req.count)) return { inv: opts.inv, chest: opts.chest };
  return { inv: { ...opts.inv, slots: nextSlots }, chest: opts.chest };
}

export function tickLocalBubbleState(
  player: PlayerSnapshot,
  timerSec: number,
  dt: number,
): { readonly player: PlayerSnapshot; readonly timerSec: number } {
  if (timerSec <= 0) return { player, timerSec: 0 };
  const nextSec = Math.max(0, timerSec - dt);
  const next = { ...player } as { -readonly [K in keyof PlayerSnapshot]: PlayerSnapshot[K] };
  if (nextSec === 0) delete next.activeBubble;
  else if (next.activeBubble) next.activeBubble = { ...next.activeBubble, remainingSec: nextSec };
  return { player: next, timerSec: nextSec };
}

export function makeLocalChatEcho(opts: {
  readonly player: PlayerSnapshot; readonly text: string; readonly shout: boolean; readonly durationSec: number;
}): { readonly player: PlayerSnapshot; readonly entry: ChatEntry } {
  const { player, text, shout, durationSec } = opts;
  return {
    player: { ...player, activeBubble: { text, ...(shout ? { shout: true } : {}), remainingSec: durationSec } },
    entry: { id: `local-${Date.now()}`, senderId: player.id, senderName: player.name, text, shout, x: player.x, y: player.y, sentAtTick: 0 },
  };
}

function isUsableConsumableDef(def: ReturnType<typeof getItemDef>): boolean {
  if (!def) return false;
  return Boolean(def.healHp || def.hotHp || def.hotDurationSec || def.wellFedSec || def.invigoratedSec || def.buffEffect || def.curesStatuses);
}

export function applyUseItemClient(inv: InventorySnapshot, slotIndex: number): InventorySnapshot {
  const item = inv.slots[slotIndex];
  if (!item || !isUsableConsumableDef(getItemDef(item.itemId))) return inv;
  const nextSlots = inv.slots.map((s) => (s ? { ...s } : null));
  if (!removeFromSlot(nextSlots, slotIndex, 1)) return inv;
  return { ...inv, slots: nextSlots };
}

function dropFromArmorSlot(opts: { readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined; readonly slot?: ArmorSlotKey | undefined }) {
  if (!opts.slot || !opts.inv.armor[opts.slot]) return { inv: opts.inv, chest: opts.chest };
  const nextPrefixes = opts.inv.armorPrefixes ? { ...opts.inv.armorPrefixes } : undefined;
  if (nextPrefixes) delete nextPrefixes[opts.slot];
  const hasPrefixes = Boolean(nextPrefixes && Object.keys(nextPrefixes).length > 0);
  return {
    inv: withArmorResult(opts.inv, { slots: opts.inv.slots, armor: { ...opts.inv.armor, [opts.slot]: null }, ...(hasPrefixes ? { armorPrefixes: nextPrefixes } : {}) }),
    chest: opts.chest,
  };
}

function applyClientDropItem(opts: {
  readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined; readonly req: DropItemRequest;
}): { readonly inv: InventorySnapshot; readonly chest?: WorldChestSnapshot | undefined } {
  if (opts.req.source === "chest") return dropFromChestSlot(opts);
  if (opts.req.source === "inv") return dropFromInvSlot(opts);
  return dropFromArmorSlot({ inv: opts.inv, chest: opts.chest, slot: opts.req.armorSlot });
}

export function applyDropToClientState(opts: {
  readonly inv: InventorySnapshot;
  readonly chests: readonly WorldChestSnapshot[];
  readonly req: DropItemRequest;
}): { readonly inv: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[] } {
  const chest = opts.req.source === "chest" && opts.req.chestId
    ? opts.chests.find((c) => c.id === opts.req.chestId)
    : undefined;
  const next = applyClientDropItem({ inv: opts.inv, chest, req: opts.req });
  const nextChest = next.chest;
  return {
    inv: next.inv,
    chests: nextChest ? opts.chests.map((c) => (c.id === nextChest.id ? nextChest : c)) : opts.chests,
  };
}

export function reconcileInventorySnapshot(input: {
  readonly current: InventorySnapshot;
  readonly incoming: InventorySnapshot;
  readonly pendingSeq: number;
  readonly elapsedMs: number;
  readonly timeoutMs?: number;
}): { readonly inventory: InventorySnapshot; readonly clearedPending: boolean } {
  if (input.pendingSeq <= 0) return { inventory: input.incoming, clearedPending: false };
  const timeoutMs = input.timeoutMs ?? 1500;
  const ack = input.incoming.ackSeq ?? 0;
  if (ack >= input.pendingSeq || input.elapsedMs >= timeoutMs) {
    return { inventory: input.incoming, clearedPending: true };
  }
  return {
    inventory: { ...input.current, nearCampfire: input.incoming.nearCampfire, nearWorkbench: input.incoming.nearWorkbench },
    clearedPending: false,
  };
}
