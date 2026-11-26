/** Pure client-side offline Hub simulation: Fog-of-War, Merchant, Blacksmith, Stash, Bounties & Quests. */
import {
  computeSellPrice, findMerchantOffer, maxStackForItem,
} from "@dc2d/content";
import {
  applyBlacksmithReforge, applyBlacksmithUpgrade, applyFogChunkDeltas, createFogState,
  decodeFogMask, encodeFogMask, insertIntoSlots, makeSlotItem, periodForPhase,
  quickTransferStashSlot, removeFromSlot, revealFogAroundPlayer, takeAllFromStash,
  type ActiveBountyState, type ActiveQuestState, type InventorySlot, type InventorySnapshot,
  type PlayerSnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { ClientHubState } from "../hubClientBridge.js";
import type { OfflineWorldSnapshot } from "../offlinePersistence.js";

const DAYTIME_PERIODS = new Set(["Dawn", "Day", "Golden Hour"]);
const HUB_NOTICE_KIND = "hubNotice" as const;
const ERR_INV_FULL = "Inventory full";

export interface OfflineHubMutateContext {
  readonly hub: ClientHubState;
  readonly inv: InventorySnapshot;
  readonly player: PlayerSnapshot;
  readonly worldSeed: number;
  readonly events: WorldEvent[];
}

function pushNotice(ctx: Pick<OfflineHubMutateContext, "player" | "events">, label: string): void {
  ctx.events.push({ kind: HUB_NOTICE_KIND, x: ctx.player.x, y: ctx.player.y, actorId: ctx.player.id, label });
}

function pushGoldGain(ctx: Pick<OfflineHubMutateContext, "player" | "events">, value: number): void {
  if (value > 0) ctx.events.push({ kind: "goldGain", x: ctx.player.x, y: ctx.player.y, actorId: ctx.player.id, value });
}

const cloneInvSlots = (slots: readonly InventorySlot[]): InventorySlot[] =>
  slots.map((s) => (s ? makeSlotItem(s.itemId, s.count, { prefixId: s.prefixId, upgradeLevel: s.upgradeLevel }) : null));

export function hydrateOfflineHubState(saved: OfflineWorldSnapshot, hub: ClientHubState): void {
  hub.gold = saved.gold ?? 0;
  hub.fog = saved.fogMask ? decodeFogMask(saved.fogMask) : createFogState();
  hub.fogVersion += 1;
  hub.lastFogKey = "";
  if (saved.stashSlots) hub.stash = saved.stashSlots.map((s) => (s ? { ...s } : null));
  if (saved.bounties?.length) hub.bounties = saved.bounties.map((b) => ({ ...b }));
  if (saved.quests?.length) hub.quests = saved.quests.map((q) => ({ ...q }));
}

export function serializeOfflineHubState(hub: ClientHubState) {
  return {
    gold: hub.gold,
    fogMask: encodeFogMask(hub.fog),
    stashSlots: hub.stash.map((s) => (s ? { ...s } : null)),
    bounties: hub.bounties.map((b) => ({ ...b })),
    quests: hub.quests.map((q) => ({ ...q })),
  };
}

export function stepOfflineFog(opts: {
  readonly hub: ClientHubState; readonly player: PlayerSnapshot; readonly dayPhase: number;
}): boolean {
  const isDaytime = DAYTIME_PERIODS.has(periodForPhase(opts.dayPhase));
  const key = `${Math.floor(opts.player.x)},${Math.floor(opts.player.y)},${opts.player.elevation},${isDaytime ? 1 : 0}`;
  if (key === opts.hub.lastFogKey) return false;
  opts.hub.lastFogKey = key;
  const deltas = revealFogAroundPlayer(opts.hub.fog, {
    x: opts.player.x, y: opts.player.y, elevation: opts.player.elevation, isDaytime,
  });
  if (deltas.length === 0) return false;
  applyFogChunkDeltas(opts.hub.fog, deltas);
  opts.hub.fogVersion += 1;
  return true;
}

export function applyOfflineMerchantBuy(ctx: OfflineHubMutateContext, req: { readonly offerId: string; readonly count: number }): InventorySnapshot | null {
  const offer = findMerchantOffer(req.offerId, ctx.worldSeed);
  if (!offer) { pushNotice(ctx, "Offer unavailable"); return null; }
  const bundles = Math.max(1, Math.min(64, Math.floor(req.count)));
  const cost = offer.goldCost * bundles;
  if (ctx.hub.gold < cost) { pushNotice(ctx, "Not enough Gold"); return null; }
  const units = offer.quantity * bundles;
  const slots = cloneInvSlots(ctx.inv.slots);
  if (insertIntoSlots(slots, makeSlotItem(offer.itemId, units), maxStackForItem) < units) {
    pushNotice(ctx, ERR_INV_FULL);
    return null;
  }
  ctx.hub.gold -= cost;
  pushNotice(ctx, `Bought ${units}x ${offer.itemId}`);
  return { ...ctx.inv, slots, gold: ctx.hub.gold };
}

export function applyOfflineMerchantSell(ctx: OfflineHubMutateContext, slotIndex: number): InventorySnapshot | null {
  const slots = cloneInvSlots(ctx.inv.slots);
  const removed = removeFromSlot(slots, slotIndex);
  if (!removed) return null;
  const earned = computeSellPrice(removed) * removed.count;
  ctx.hub.gold += earned;
  pushGoldGain(ctx, earned);
  pushNotice(ctx, `Sold for +${earned} Gold`);
  return { ...ctx.inv, slots, gold: ctx.hub.gold };
}

function formatBlacksmithSuccess(mode: "reforge" | "upgrade", updated: ReturnType<typeof applyBlacksmithUpgrade>["updatedItem"]): string {
  return mode === "reforge"
    ? `Reforged ${updated?.prefixId ?? "gear"}`
    : `Upgraded to +${updated?.upgradeLevel ?? 1}`;
}

function runBlacksmithMode(ctx: OfflineHubMutateContext, opts: { readonly mode: "reforge" | "upgrade"; readonly slotIndex: number }) {
  return opts.mode === "reforge"
    ? applyBlacksmithReforge({ slots: ctx.inv.slots, gold: ctx.hub.gold, slotIndex: opts.slotIndex, unitRoll: Math.random() })
    : applyBlacksmithUpgrade({ slots: ctx.inv.slots, gold: ctx.hub.gold, slotIndex: opts.slotIndex });
}

export function applyOfflineBlacksmithOp(
  ctx: OfflineHubMutateContext,
  opts: { readonly mode: "reforge" | "upgrade"; readonly slotIndex: number },
): InventorySnapshot | null {
  const res = runBlacksmithMode(ctx, opts);
  if (!res.ok) { pushNotice(ctx, res.error ?? "Forge failed"); return null; }
  ctx.hub.gold = res.gold;
  pushNotice(ctx, formatBlacksmithSuccess(opts.mode, res.updatedItem));
  return { ...ctx.inv, slots: res.slots, gold: ctx.hub.gold };
}

export function applyOfflineStashMove(
  ctx: OfflineHubMutateContext,
  req: { readonly from: "stash" | "inv"; readonly slotIndex: number } | "takeAll",
): InventorySnapshot | null {
  const invSlots = cloneInvSlots(ctx.inv.slots);
  const stashSlots = cloneInvSlots(ctx.hub.stash);
  const changed = req === "takeAll"
    ? takeAllFromStash({ stashSlots, invSlots, maxStackFor: maxStackForItem }) > 0
    : quickTransferStashSlot({ stashSlots, invSlots, from: req.from, slotIndex: req.slotIndex, maxStackFor: maxStackForItem });
  if (!changed) { pushNotice(ctx, ERR_INV_FULL); return null; }
  ctx.hub.stash = stashSlots;
  return { ...ctx.inv, slots: invSlots };
}

function tryInsertReward(
  slots: InventorySlot[],
  item: { readonly rewardItemId?: string | undefined; readonly rewardCount?: number | undefined },
): boolean {
  if (!item.rewardItemId) return true;
  const count = item.rewardCount ?? 1;
  return insertIntoSlots(slots, makeSlotItem(item.rewardItemId, count), maxStackForItem) >= count;
}

function claimObjectiveReward<T extends ActiveBountyState | ActiveQuestState>(
  list: T[],
  id: string,
  ctx: OfflineHubMutateContext,
): { readonly nextList: T[]; readonly nextInv: InventorySnapshot } | null {
  const item = list.find((entry) => entry.id === id);
  if (!item || !item.accepted || item.claimed || item.progress < item.required) return null;
  const slots = cloneInvSlots(ctx.inv.slots);
  if (!tryInsertReward(slots, item)) { pushNotice(ctx, ERR_INV_FULL); return null; }
  ctx.hub.gold += item.rewardGold;
  pushGoldGain(ctx, item.rewardGold);
  pushNotice(ctx, `Claimed +${item.rewardGold} Gold`);
  return { nextList: list.map((e) => (e.id === id ? { ...e, claimed: true } : e)), nextInv: { ...ctx.inv, slots, gold: ctx.hub.gold } };
}

export function applyOfflineObjectiveAction(
  ctx: OfflineHubMutateContext,
  opts: { readonly pool: "bounty" | "quest"; readonly mode: "accept" | "claim"; readonly id: string },
): InventorySnapshot | null {
  if (opts.pool === "bounty") {
    if (opts.mode === "accept") {
      ctx.hub.bounties = ctx.hub.bounties.map((b) => (b.id === opts.id ? { ...b, accepted: true } : b));
      pushNotice(ctx, "Bounty accepted");
      return ctx.inv;
    }
    const res = claimObjectiveReward(ctx.hub.bounties, opts.id, ctx);
    if (!res) return null;
    ctx.hub.bounties = res.nextList;
    return res.nextInv;
  }
  if (opts.mode === "accept") {
    ctx.hub.quests = ctx.hub.quests.map((q) => (q.id === opts.id ? { ...q, accepted: true } : q));
    pushNotice(ctx, "Quest accepted");
    return ctx.inv;
  }
  const res = claimObjectiveReward(ctx.hub.quests, opts.id, ctx);
  if (!res) return null;
  ctx.hub.quests = res.nextList;
  return res.nextInv;
}

export function applyOfflineGiveGold(ctx: Pick<OfflineHubMutateContext, "hub" | "inv" | "player" | "events">, amount: number): InventorySnapshot {
  const delta = Math.max(1, Math.min(100_000, Math.round(amount)));
  ctx.hub.gold += delta;
  pushGoldGain(ctx, delta);
  return { ...ctx.inv, gold: ctx.hub.gold };
}
