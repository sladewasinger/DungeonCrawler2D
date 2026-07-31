import { z } from "zod";
import { debugFlagsSchema } from "../../debug/debugFlags.js";

const playerTarget = z.string().min(1).max(64);
const destination = z.enum(["spawn", "safeRoom", "self", "player"]);
const level = z.enum(["dungeon", "sandbox"]);
const coordinate = z.number().finite().min(-100000).max(100000);
const tileCoordinate = z.number().finite().int().min(-100000).max(100000);
const entityId = z.string().min(1).max(64);
const directionSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const debugPointSchema = z.object({ x: coordinate, y: coordinate, z: z.number().finite() }).strict();
const adminEntityDebugSchema = z.object({
  behavior: z.enum(["idle", "engaged", "pursuing", "searching"]).optional(),
  target: debugPointSchema.optional(),
  waypoint: debugPointSchema.optional(),
}).strict();

export const clientAdminAuthSchema = z.object({ type: z.literal("adminAuth"), token: z.string().min(1).max(256) });
/** Opaque, server-issued, tab-scoped continuation key. This is never ADMIN_TOKEN. */
export const clientAdminResumeSchema = z.object({
  type: z.literal("adminResume"),
  sessionKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const clientAdminCommandSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list") }),
  z.object({ op: z.literal("spectate"), playerId: playerTarget.nullable() }),
  z.object({ op: z.literal("spectator"), action: z.enum(["start", "stop", "cycle"]), mode: z.enum(["free", "track"]).optional(), playerId: playerTarget.nullable().optional(), direction: z.enum(["next", "previous"]).optional() }),
  z.object({ op: z.literal("teleport"), playerId: playerTarget, destination, targetPlayerId: playerTarget.optional() }),
  z.object({ op: z.literal("kill"), playerId: playerTarget }),
  z.object({ op: z.literal("heal"), playerId: playerTarget }),
  z.object({ op: z.literal("god"), playerId: playerTarget, enabled: z.boolean() }),
  z.object({ op: z.literal("handicap"), playerId: playerTarget, enabled: z.boolean() }),
  z.object({ op: z.literal("killEnemies"), centerPlayerId: playerTarget, radius: z.number().positive().max(64) }),
  z.object({ op: z.literal("assignAdmin"), playerId: playerTarget, enabled: z.boolean() }),
  z.object({ op: z.literal("map"), level, floor: z.number().int().min(1).max(64), x: coordinate, y: coordinate, radius: z.number().int().min(4).max(16) }),
  z.object({ op: z.literal("spawn"), level, floor: z.number().int().min(1).max(64), kind: z.enum(["enemy", "item", "weapon"]), defId: z.string().min(1).max(64), x: coordinate, y: coordinate }),
  z.object({ op: z.literal("despawn"), level, floor: z.number().int().min(1).max(64), entityId }),
  z.object({ op: z.literal("debug"), flags: debugFlagsSchema }),
]);
export const clientAdminCommandMessageSchema = z.object({ type: z.literal("adminCommand"), requestId: z.string().min(1).max(64).optional(), command: clientAdminCommandSchema });

const adminPlayerSchema = z.object({
  playerId: z.string(), profileId: z.string(), name: z.string(), level: z.enum(["dungeon", "sandbox"]),
  floor: z.number().int(), x: z.number(), y: z.number(), z: z.number(), hp: z.number(), maxHp: z.number(),
  downed: z.boolean(), god: z.boolean(), handicapped: z.boolean(), admin: z.boolean(), statuses: z.array(z.string()), connected: z.boolean(),
  clientId: z.string(), userAgent: z.string().optional(), platform: z.string().optional(), touch: z.boolean().optional(),
}).strict();
const adminMapCellSchema = z.object({
  x: tileCoordinate, y: tileCoordinate, height: z.number().finite(), walkable: z.boolean(),
  terrain: z.enum(["floor", "void"]), feature: z.number().int(),
}).strict();
export const adminMapEntitySchema = z.object({
  id: z.string(), kind: z.enum(["player", "enemy", "item", "weapon", "torch"]),
  defId: z.string().optional(), name: z.string().optional(), x: coordinate, y: coordinate, z: z.number().finite(),
  facing: directionSchema.optional(), blocking: z.boolean().optional(), debug: adminEntityDebugSchema.optional(),
}).strict();
const adminMapSchema = z.object({
  level, floor: z.number().int(), center: z.object({ x: coordinate, y: coordinate }).strict(), radius: z.number().int(),
  cells: z.array(adminMapCellSchema).max(1089), entities: z.array(adminMapEntitySchema).max(2048),
}).strict();
const adminPaletteSchema = z.object({
  enemies: z.array(z.string()).max(256), items: z.array(z.string()).max(256), weapons: z.array(z.string()).max(256),
}).strict();
export const adminStateSchema = z.object({
  type: z.literal("adminState"), players: z.array(adminPlayerSchema),
  spectator: z.object({ mode: z.enum(["off", "free", "track"]), playerId: z.string().nullable() }).strict(),
  map: adminMapSchema,
  spectatorMap: adminMapSchema.nullable(),
  palette: adminPaletteSchema,
  debug: debugFlagsSchema,
});
export const adminObserverStateSchema = z.object({
  type: z.literal("adminObserverState"),
  players: z.array(adminPlayerSchema),
  spectator: z.object({ mode: z.enum(["off", "free", "track"]), playerId: z.string().nullable() }).strict(),
  spectatorMap: adminMapSchema.nullable(),
});
export const adminAuthResultSchema = z.object({
  type: z.literal("adminAuthResult"),
  ok: z.boolean(),
  reason: z.enum(["disabled", "invalid", "rate_limited", "expired"]).optional(),
  capabilities: z.array(z.string()).optional(),
  sessionKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
});
export const adminCommandResultSchema = z.object({ type: z.literal("adminCommandResult"), ok: z.boolean(), requestId: z.string().optional(), code: z.string().optional(), message: z.string().optional() });

export type AdminCommand = z.infer<typeof clientAdminCommandSchema>;
export type AdminCommandMessage = z.infer<typeof clientAdminCommandMessageSchema>;
export type AdminResumeMessage = z.infer<typeof clientAdminResumeSchema>;
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;
export type AdminState = z.infer<typeof adminStateSchema>;
export type AdminObserverState = z.infer<typeof adminObserverStateSchema>;
export type AdminMap = z.infer<typeof adminMapSchema>;
export type AdminMapCell = z.infer<typeof adminMapCellSchema>;
export type AdminMapEntity = z.infer<typeof adminMapEntitySchema>;
export type AdminPalette = z.infer<typeof adminPaletteSchema>;
