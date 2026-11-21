import { z } from "zod";
import { debugFlagsSchema } from "../../debug/debugFlags.js";
import { floorGenerationIdentitySchema } from "../schemas/floorGenerationIdentity.js";
import { TERRITORY_IDS, type TerritoryId } from "../../world/generate/territories/territoryCatalog.js";
import {
  ADMIN_MAP_MAX_RADIUS,
  adminCoordinateSchema,
  adminDestinationSchema,
  adminEntityIdSchema,
  adminLevelSchema,
  adminPlayerTargetSchema,
} from "./adminProtocolPrimitives.js";

export {
  ADMIN_MAP_MAX_CELL_COUNT,
  ADMIN_MAP_MAX_RADIUS,
  ADMIN_WORLD_COORDINATE_LIMIT,
} from "./adminProtocolPrimitives.js";
export {
  adminHitboxSchema,
  adminMapEntitySchema,
  adminObserverStateSchema,
  adminStateSchema,
  type AdminHitbox,
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

const territoryIdValues = Object.values(TERRITORY_IDS) as [TerritoryId, ...TerritoryId[]];
const finiteGenerationConfigSchema = z.object({
  territoryRoster: z.array(z.enum(territoryIdValues)).min(4).max(12).optional(),
  roomSize: z.number().finite().optional(), roomSpacing: z.number().finite().optional(),
  roomTargetCount: z.number().finite().optional(), roomMinWidth: z.number().finite().optional(),
  roomMaxWidth: z.number().finite().optional(), roomMinHeight: z.number().finite().optional(),
  roomMaxHeight: z.number().finite().optional(), roomSizeVariation: z.number().finite().optional(),
  roomEntranceWidth: z.number().finite().optional(), mazeDensity: z.number().finite().optional(),
  connectorDensity: z.number().finite().optional(), territoryLayoutDensity: z.number().finite().optional(),
  targetLoopCount: z.number().finite().optional(), minimumLoopPathSaving: z.number().finite().optional(),
  connectorSpacing: z.number().finite().optional(), ordinaryCorridorWidthMin: z.number().finite().optional(),
  ordinaryCorridorWidthMax: z.number().finite().optional(), mazeCorridorWidth: z.number().finite().optional(),
  deadEndRemovalFraction: z.number().finite().optional(), minimumBiomeArea: z.number().finite().optional(),
  elevationStep: z.number().finite().optional(), stairTreadCount: z.number().finite().optional(),
}).strict();

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
    x: adminCoordinateSchema,
    y: adminCoordinateSchema,
    radius: z.number().int().min(4).max(ADMIN_MAP_MAX_RADIUS),
  }),
  adminSpawnSchema,
  z.object({
    op: z.literal("despawn"), level: adminLevelSchema, floor: z.number().int().min(1).max(64), entityId: adminEntityIdSchema,
  }),
  z.object({ op: z.literal("debug"), flags: debugFlagsSchema }),
  z.object({
    op: z.literal("applyGeneratedFloor"),
    floor: z.number().int().min(1).max(64),
    confirm: z.literal(true),
    config: finiteGenerationConfigSchema.optional(),
    expectedGeneration: floorGenerationIdentitySchema.optional(),
  }),
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
  code: z.string().optional(), message: z.string().optional(), floor: z.number().int().optional(),
  generation: floorGenerationIdentitySchema.optional(),
});

export type AdminCommand = z.infer<typeof clientAdminCommandSchema>;
export type AdminCommandMessage = z.infer<typeof clientAdminCommandMessageSchema>;
export type AdminResumeMessage = z.infer<typeof clientAdminResumeSchema>;
export type AdminLogoutMessage = z.infer<typeof clientAdminLogoutSchema>;
