import { z } from "zod";
import { debugFlagsSchema } from "../../debug/debugFlags.js";
import {
  adminCoordinateSchema,
  adminDestinationSchema,
  adminEntityIdSchema,
  adminLevelSchema,
  adminPlayerTargetSchema,
} from "./adminProtocolPrimitives.js";

export { ADMIN_WORLD_COORDINATE_LIMIT } from "./adminProtocolPrimitives.js";
export {
  adminAttackAreaSchema,
  adminMapEntitySchema,
  adminObserverStateSchema,
  adminStateSchema,
  type AdminAttackArea,
  type AdminHistoryEntry,
  type AdminMap,
  type AdminMapCell,
  type AdminMapEntity,
  type AdminObserverState,
  type AdminPalette,
  type AdminPlayer,
  type AdminState,
} from "./adminStateSchemas.js";

const adminSpawnSchema = z.object({
  op: z.literal("spawn"),
  level: adminLevelSchema,
  floor: z.number().int().min(1).max(64),
  kind: z.enum(["enemy", "item", "weapon", "pet"]),
  defId: z.string().min(1).max(64),
  x: adminCoordinateSchema,
  y: adminCoordinateSchema,
  ownerPlayerId: adminPlayerTargetSchema.optional(),
}).superRefine((command, context) => {
  if (command.kind !== "pet" || command.ownerPlayerId) return;
  context.addIssue({ code: "custom", message: "Pet spawn requires an owner player." });
});

export const clientAdminAuthSchema = z.object({
  type: z.literal("adminAuth"),
  token: z.string().min(1).max(256),
});
export const clientAdminResumeSchema = z.object({
  type: z.literal("adminResume"),
  sessionKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const clientAdminLogoutSchema = z.object({ type: z.literal("adminLogout") });
export const clientAdminCommandSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list") }),
  z.object({ op: z.literal("spectate"), playerId: adminPlayerTargetSchema.nullable() }),
  z.object({
    op: z.literal("spectator"),
    action: z.enum(["start", "stop", "cycle"]),
    mode: z.enum(["free", "track"]).optional(),
    playerId: adminPlayerTargetSchema.nullable().optional(),
    direction: z.enum(["next", "previous"]).optional(),
  }),
  z.object({
    op: z.literal("teleport"),
    playerId: adminPlayerTargetSchema,
    destination: adminDestinationSchema,
    targetPlayerId: adminPlayerTargetSchema.optional(),
    x: adminCoordinateSchema.optional(),
    y: adminCoordinateSchema.optional(),
  }).superRefine((command, context) => {
    if (command.destination !== "coordinates") return;
    if (command.x !== undefined && command.y !== undefined) return;
    context.addIssue({ code: "custom", message: "Coordinate teleport requires x and y." });
  }),
  z.object({ op: z.literal("kill"), playerId: adminPlayerTargetSchema }),
  z.object({ op: z.literal("heal"), playerId: adminPlayerTargetSchema }),
  z.object({ op: z.literal("god"), playerId: adminPlayerTargetSchema, enabled: z.boolean() }),
  z.object({ op: z.literal("handicap"), playerId: adminPlayerTargetSchema, enabled: z.boolean() }),
  z.object({ op: z.literal("killEnemies"), centerPlayerId: adminPlayerTargetSchema, radius: z.number().positive().max(64) }),
  z.object({ op: z.literal("assignAdmin"), playerId: adminPlayerTargetSchema, enabled: z.boolean() }),
  z.object({
    op: z.literal("map"), level: adminLevelSchema, floor: z.number().int().min(1).max(64),
    x: adminCoordinateSchema, y: adminCoordinateSchema, radius: z.number().int().min(4).max(16),
  }),
  adminSpawnSchema,
  z.object({
    op: z.literal("despawn"), level: adminLevelSchema, floor: z.number().int().min(1).max(64), entityId: adminEntityIdSchema,
  }),
  z.object({ op: z.literal("debug"), flags: debugFlagsSchema }),
]);
export const clientAdminCommandMessageSchema = z.object({
  type: z.literal("adminCommand"),
  requestId: z.string().min(1).max(64).optional(),
  command: clientAdminCommandSchema,
});
export const adminAuthResultSchema = z.object({
  type: z.literal("adminAuthResult"), ok: z.boolean(),
  reason: z.enum(["disabled", "invalid", "rate_limited", "expired", "logged_out"]).optional(),
  capabilities: z.array(z.string()).optional(),
  sessionKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
});
export const adminCommandResultSchema = z.object({
  type: z.literal("adminCommandResult"), ok: z.boolean(), requestId: z.string().optional(),
  code: z.string().optional(), message: z.string().optional(),
});

export type AdminCommand = z.infer<typeof clientAdminCommandSchema>;
export type AdminCommandMessage = z.infer<typeof clientAdminCommandMessageSchema>;
export type AdminResumeMessage = z.infer<typeof clientAdminResumeSchema>;
export type AdminLogoutMessage = z.infer<typeof clientAdminLogoutSchema>;
