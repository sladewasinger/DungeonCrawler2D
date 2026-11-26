/** Server-authoritative Merchant buy/sell & Blacksmith reforge/upgrade operations [REQ-P9-08..11]. */
import {
  computeSellPrice,
  findMerchantOffer,
  maxStackForItem,
} from "@dc2d/content";
import {
  PropKind,
  applyBlacksmithReforge,
  applyBlacksmithUpgrade,
  insertIntoSlots,
  makeSlotItem,
  removeFromSlot,
  type InventorySlot,
  type PlayerInventoryState,
  type WorldChunkCache,
} from "@dc2d/engine";
import type { NpcKind } from "@dc2d/contracts";

const HUB_INTERACT_RADIUS = 3.2;

const PROP_TO_NPC: Readonly<Partial<Record<PropKind, NpcKind | "stash">>> = {
  [PropKind.NpcGuide]: "guide",
  [PropKind.NpcMerchant]: "merchant",
  [PropKind.NpcBlacksmith]: "blacksmith",
  [PropKind.BountyBoard]: "bounty-board",
  [PropKind.StashChest]: "stash",
};

export function findNearestHubStation(
  cache: WorldChunkCache,
  pos: { readonly x: number; readonly y: number },
): { readonly propId: string; readonly kind: NpcKind | "stash"; readonly x: number; readonly y: number } | null {
  let bestDist = HUB_INTERACT_RADIUS;
  let match: { readonly propId: string; readonly kind: NpcKind | "stash"; readonly x: number; readonly y: number } | null = null;
  for (const prop of cache.propsNear(pos.x, pos.y)) {
    const hubKind = PROP_TO_NPC[prop.kind];
    if (!hubKind) continue;
    const dist = Math.hypot(prop.x - pos.x, prop.y - pos.y);
    if (dist <= bestDist) {
      bestDist = dist;
      match = { propId: prop.id, kind: hubKind, x: prop.x, y: prop.y };
    }
  }
  return match;
}

export function isNearHubStationKind(
  cache: WorldChunkCache,
  pos: { readonly x: number; readonly y: number },
  expected: readonly (NpcKind | "stash")[],
): boolean {
  for (const prop of cache.propsNear(pos.x, pos.y)) {
    const hubKind = PROP_TO_NPC[prop.kind];
    if (!hubKind || !expected.includes(hubKind)) continue;
    if (Math.hypot(prop.x - pos.x, prop.y - pos.y) <= HUB_INTERACT_RADIUS) return true;
  }
  return false;
}

function cloneSlots(slots: readonly InventorySlot[]): InventorySlot[] {
  return slots.map((s) => (s ? makeSlotItem(s.itemId, s.count, { prefixId: s.prefixId, upgradeLevel: s.upgradeLevel }) : null));
}

export function executeMerchantBuy(opts: {
  readonly gold: number;
  readonly inventory: PlayerInventoryState;
  readonly offerId: string;
  readonly count: number;
  readonly worldSeed: number;
}): { readonly ok: boolean; readonly gold: number; readonly inventory: PlayerInventoryState; readonly message: string } {
  const offer = findMerchantOffer(opts.offerId, opts.worldSeed);
  if (!offer) return { ok: false, gold: opts.gold, inventory: opts.inventory, message: "Offer unavailable" };
  const bundles = Math.max(1, Math.min(64, Math.floor(opts.count)));
  const totalCost = offer.goldCost * bundles;
  if (opts.gold < totalCost) return { ok: false, gold: opts.gold, inventory: opts.inventory, message: "Not enough Gold" };

  const totalUnits = offer.quantity * bundles;
  const probeSlots = cloneSlots(opts.inventory.slots);
  const added = insertIntoSlots(probeSlots, makeSlotItem(offer.itemId, totalUnits), maxStackForItem);
  if (added < totalUnits) return { ok: false, gold: opts.gold, inventory: opts.inventory, message: "Inventory full" };

  return {
    ok: true,
    gold: opts.gold - totalCost,
    inventory: { ...opts.inventory, slots: probeSlots },
    message: `Bought ${totalUnits}x ${offer.itemId}`,
  };
}

export function executeMerchantSell(opts: {
  readonly gold: number;
  readonly inventory: PlayerInventoryState;
  readonly slotIndex: number;
}): { readonly ok: boolean; readonly gold: number; readonly inventory: PlayerInventoryState; readonly earned: number; readonly message: string } {
  const nextSlots = cloneSlots(opts.inventory.slots);
  const removed = removeFromSlot(nextSlots, opts.slotIndex);
  if (!removed) return { ok: false, gold: opts.gold, inventory: opts.inventory, earned: 0, message: "Empty slot" };
  const unitPrice = computeSellPrice({ itemId: removed.itemId, prefixId: removed.prefixId, upgradeLevel: removed.upgradeLevel });
  const earned = unitPrice * removed.count;
  return {
    ok: true,
    gold: opts.gold + earned,
    inventory: { ...opts.inventory, slots: nextSlots },
    earned,
    message: `Sold for +${earned} Gold`,
  };
}

export function executeBlacksmithReforge(opts: {
  readonly gold: number;
  readonly inventory: PlayerInventoryState;
  readonly slotIndex: number;
  readonly rollSeed: number;
}): { readonly ok: boolean; readonly gold: number; readonly inventory: PlayerInventoryState; readonly message: string } {
  const unitRoll = (Math.abs(Math.sin(opts.rollSeed * 12.9898) * 43758.5453)) % 1;
  const res = applyBlacksmithReforge({
    slots: opts.inventory.slots,
    gold: opts.gold,
    slotIndex: opts.slotIndex,
    unitRoll,
  });
  if (!res.ok) return { ok: false, gold: opts.gold, inventory: opts.inventory, message: res.error ?? "Reforge failed" };
  return {
    ok: true,
    gold: res.gold,
    inventory: { ...opts.inventory, slots: res.slots },
    message: `Reforged ${res.updatedItem?.prefixId ?? "gear"}`,
  };
}

export function executeBlacksmithUpgrade(opts: {
  readonly gold: number;
  readonly inventory: PlayerInventoryState;
  readonly slotIndex: number;
}): { readonly ok: boolean; readonly gold: number; readonly inventory: PlayerInventoryState; readonly message: string } {
  const res = applyBlacksmithUpgrade({
    slots: opts.inventory.slots,
    gold: opts.gold,
    slotIndex: opts.slotIndex,
  });
  if (!res.ok) return { ok: false, gold: opts.gold, inventory: opts.inventory, message: res.error ?? "Upgrade failed" };
  return {
    ok: true,
    gold: res.gold,
    inventory: { ...opts.inventory, slots: res.slots },
    message: `Upgraded to +${res.updatedItem?.upgradeLevel ?? 1}`,
  };
}
