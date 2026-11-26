/** Zod wire schemas for Phase 9 Fog-of-War deltas, Sanctuary Stash, Bounties, Quests, and NPC actions. */
import { z } from "zod";
import { TOTAL_INVENTORY_SLOTS } from "../inventory/slotModel.js";

export const FogChunkDeltaSchema = z.object({
  cx: z.number().int(),
  cy: z.number().int(),
  mask: z.number().int().min(0).max(0xffff),
});

export type FogChunkDeltaSnapshot = z.infer<typeof FogChunkDeltaSchema>;

export const ActiveBountyStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  targetKind: z.string().min(1),
  progress: z.number().int().nonnegative(),
  required: z.number().int().positive(),
  rewardGold: z.number().int().nonnegative(),
  rewardItemId: z.string().min(1).optional(),
  rewardCount: z.number().int().positive().optional(),
  accepted: z.boolean(),
  claimed: z.boolean(),
});

export type ActiveBountyState = z.infer<typeof ActiveBountyStateSchema>;

export const ActiveQuestStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  dialogue: z.string().min(1),
  hintText: z.string().min(1),
  progress: z.number().int().nonnegative(),
  required: z.number().int().positive(),
  rewardGold: z.number().int().nonnegative(),
  rewardItemId: z.string().min(1).optional(),
  rewardCount: z.number().int().positive().optional(),
  accepted: z.boolean(),
  claimed: z.boolean(),
});

export type ActiveQuestState = z.infer<typeof ActiveQuestStateSchema>;

const HubIdSchema = z.string().min(1).max(64);
const InvSlotSchema = z.number().int().min(0).max(TOTAL_INVENTORY_SLOTS - 1);

export const ClientInteractNpcSchema = z.object({
  t: z.literal("interactNpc"),
  npcId: HubIdSchema,
});

export const ClientMerchantBuySchema = z.object({
  t: z.literal("merchantBuy"),
  offerId: HubIdSchema,
  count: z.number().int().min(1).max(64).default(1),
});

export const ClientMerchantSellSchema = z.object({
  t: z.literal("merchantSell"),
  slotIndex: InvSlotSchema,
});

export const ClientBlacksmithReforgeSchema = z.object({
  t: z.literal("blacksmithReforge"),
  slotIndex: InvSlotSchema,
});

export const ClientBlacksmithUpgradeSchema = z.object({
  t: z.literal("blacksmithUpgrade"),
  slotIndex: InvSlotSchema,
});

export const ClientBountyAcceptSchema = z.object({
  t: z.literal("bountyAccept"),
  bountyId: HubIdSchema,
});

export const ClientBountyClaimSchema = z.object({
  t: z.literal("bountyClaim"),
  bountyId: HubIdSchema,
});

export const ClientQuestAcceptSchema = z.object({
  t: z.literal("questAccept"),
  questId: HubIdSchema,
});

export const ClientQuestClaimSchema = z.object({
  t: z.literal("questClaim"),
  questId: HubIdSchema,
});

export const ClientStashTransferSchema = z.object({
  t: z.literal("stashTransfer"),
  from: z.enum(["stash", "inv"]),
  fromSlot: z.number().int().min(0).max(TOTAL_INVENTORY_SLOTS - 1),
  to: z.enum(["stash", "inv"]),
  toSlot: z.number().int().min(0).max(TOTAL_INVENTORY_SLOTS - 1),
});

export const ClientStashQuickMoveSchema = z.object({
  t: z.literal("stashQuickMove"),
  from: z.enum(["stash", "inv"]),
  slotIndex: z.number().int().min(0).max(TOTAL_INVENTORY_SLOTS - 1),
});

export const ClientStashTakeAllSchema = z.object({
  t: z.literal("stashTakeAll"),
});
