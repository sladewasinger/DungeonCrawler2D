import { z } from "zod";
import { clientNetworkProfileSchema } from "../networkProfile.js";
import { clientHelloSchema } from "./hello.js";
import {
  clientAdminAuthSchema,
  clientAdminCommandMessageSchema,
  clientAdminResumeSchema,
} from "./admin.js";

const axis = z.number().min(-1).max(1);
const slot = z.number().int().min(0).max(8);
export const clientInputSchema = z.object({ type: z.literal("input"), seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), projectedServerTick: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), moveX: axis, moveY: axis, faceX: axis.optional(), faceY: axis.optional(), jump: z.boolean(), run: z.boolean().default(false), block: z.boolean().optional() });
export const clientAttackSchema = z.object({ type: z.literal("attack"), dirX: z.number().min(-1).max(1), dirY: z.number().min(-1).max(1) });
export const clientUseSlotSchema = z.object({ type: z.literal("useSlot"), slot, targetX: z.number().optional(), targetY: z.number().optional(), targetId: z.string().max(64).optional() });
export const clientUseItemSchema = z.object({ type: z.literal("useItem"), item: z.string().max(64) });
export const clientPickupSchema = z.object({ type: z.literal("pickup") });
export const clientDropSchema = z.object({ type: z.literal("drop"), item: z.string().max(64) });
export const clientAssignSchema = z.object({ type: z.literal("assign"), slot, item: z.string().max(64).nullable() });
export const clientEquipSchema = z.object({ type: z.literal("equip"), item: z.string().max(64).nullable() });
export const clientThrowTorchSchema = z.object({ type: z.literal("throwTorch"), dirX: z.number(), dirY: z.number() });
export const clientInteractSchema = z.object({ type: z.literal("interact") });
export const clientReviveSchema = z.object({ type: z.literal("revive"), targetId: z.string().max(64), held: z.boolean() });
export const clientDescendSchema = z.object({ type: z.literal("descend") });
export const clientCraftSchema = z.object({ type: z.literal("craft"), recipe: z.string().max(64) });
export const clientStashSchema = z.object({ type: z.literal("stash"), op: z.enum(["put", "take"]), index: z.number().int().min(0).max(63) });
export const clientLootChestSchema = z.object({ type: z.literal("lootChest"), chestId: z.string().max(64), op: z.enum(["open", "take", "takeAll", "close"]), item: z.string().max(64).optional() });
export const clientPartySchema = z.object({ type: z.literal("party"), op: z.enum(["invite", "accept", "decline", "cancel", "leave", "kick"]), target: z.string().max(32).optional() });
export const clientModerationSchema = z.object({ type: z.literal("moderation"), op: z.enum(["mute", "unmute", "block", "unblock", "report"]), target: z.string().min(1).max(64), reason: z.string().max(200).optional() });
export const clientChatSchema = z.object({ type: z.literal("chat"), channel: z.enum(["party", "local", "global", "dm"]), text: z.string().min(1).max(200), target: z.string().min(1).max(32).optional() });
export const clientFistbumpSchema = z.object({ type: z.literal("fistbump"), targetId: z.string().max(64) });
export const clientWhoSchema = z.object({ type: z.literal("who") });
export const clientPingSchema = z.object({ type: z.literal("ping"), t: z.number() });
export const clientSuicideSchema = z.object({ type: z.literal("suicide") });
export const clientRescueSchema = z.object({ type: z.literal("rescue") });
export const clientRespawnSchema = z.object({ type: z.literal("respawn") });
export const clientSnapshotResyncSchema = z.object({ type: z.literal("snapshotResync") });
export const clientDebugSchema = z.object({ type: z.literal("debug"), op: z.enum(["teleport", "god"]), x: z.number().optional(), y: z.number().optional(), on: z.boolean().optional() });
export const clientMessageSchema = z.discriminatedUnion("type", [clientHelloSchema, clientInputSchema, clientAttackSchema, clientUseSlotSchema, clientUseItemSchema, clientThrowTorchSchema, clientPickupSchema, clientDropSchema, clientAssignSchema, clientEquipSchema, clientInteractSchema, clientReviveSchema, clientDescendSchema, clientCraftSchema, clientStashSchema, clientLootChestSchema, clientPartySchema, clientModerationSchema, clientChatSchema, clientFistbumpSchema, clientWhoSchema, clientPingSchema, clientSuicideSchema, clientRescueSchema, clientRespawnSchema, clientSnapshotResyncSchema, clientNetworkProfileSchema, clientDebugSchema, clientAdminAuthSchema, clientAdminResumeSchema, clientAdminCommandMessageSchema]);
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
