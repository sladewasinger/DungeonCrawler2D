import { z } from "zod";
import { debugFlagsSchema } from "../../debug/debugFlags.js";
import {
  ADMIN_MAP_MAX_CELL_COUNT,
  adminCoordinateSchema,
  adminDirectionSchema,
  adminLevelSchema,
  adminTileCoordinateSchema,
} from "./adminProtocolPrimitives.js";

const debugPointSchema = z.object({
  x: adminCoordinateSchema,
  y: adminCoordinateSchema,
  z: z.number().finite(),
}).strict();
const debugRadiusSchema = z.number().finite().positive().max(64);
const debugHurtboxSchema = z.object({
  halfWidth: debugRadiusSchema,
  halfDepth: debugRadiusSchema,
  height: debugRadiusSchema,
  bottomOffset: z.number().finite().min(-64).max(64),
}).strict();
const debugArcCosSchema = z.number().finite().min(-1).max(1);
export const adminHitboxSchema = z.discriminatedUnion("shape", [
  z.object({ shape: z.literal("circle"), radius: debugRadiusSchema }).strict(),
  z.object({
    shape: z.literal("cone"),
    direction: adminDirectionSchema,
    range: debugRadiusSchema,
    arcCos: debugArcCosSchema,
  }).strict(),
  z.object({ shape: z.literal("tile"), center: debugPointSchema }).strict(),
]);
const adminGuardAreaSchema = z.object({
  direction: adminDirectionSchema,
  radius: debugRadiusSchema,
  arcCos: debugArcCosSchema,
}).strict();
const adminSearchDebugSchema = z.object({
  anchor: debugPointSchema,
  target: debugPointSchema.optional(),
  waypoint: debugPointSchema.optional(),
}).strict();
const adminNavigationDebugSchema = z.object({
  path: z.array(debugPointSchema).min(1).max(24),
}).strict();
const adminEntityDebugSchema = z.object({
  hurtbox: debugHurtboxSchema.optional(),
  attacks: z.array(adminHitboxSchema).min(1).max(24).optional(),
  guard: adminGuardAreaSchema.optional(),
  behavior: z.enum(["idle", "engaged", "pursuing", "searching"]).optional(),
  lineOfSight: debugPointSchema.optional(),
  search: adminSearchDebugSchema.optional(),
  navigation: adminNavigationDebugSchema.optional(),
}).strict();

const adminPlayerSchema = z.object({
  playerId: z.string(), profileId: z.string(), name: z.string(), level: adminLevelSchema,
  floor: z.number().int(), x: z.number(), y: z.number(), z: z.number(), hp: z.number(), maxHp: z.number(),
  downed: z.boolean(), god: z.boolean(), handicapped: z.boolean(), admin: z.boolean(), statuses: z.array(z.string()), connected: z.boolean(),
  clientId: z.string(), userAgent: z.string().optional(), platform: z.string().optional(), touch: z.boolean().optional(),
}).strict();
const adminMapCellSchema = z.object({
  x: adminTileCoordinateSchema, y: adminTileCoordinateSchema, height: z.number().finite(), walkable: z.boolean(),
  terrain: z.enum(["floor", "void"]), feature: z.number().int(),
}).strict();
export const adminMapEntitySchema = z.object({
  id: z.string(), kind: z.enum(["player", "enemy", "pet", "item", "weapon", "projectile", "torch"]),
  defId: z.string().optional(), name: z.string().optional(), x: adminCoordinateSchema, y: adminCoordinateSchema, z: z.number().finite(),
  facing: adminDirectionSchema.optional(), blocking: z.boolean().optional(), debug: adminEntityDebugSchema.optional(),
}).strict();
const adminMapSchema = z.object({
  level: adminLevelSchema, floor: z.number().int(), center: z.object({ x: adminCoordinateSchema, y: adminCoordinateSchema }).strict(), radius: z.number().int(),
  cells: z.array(adminMapCellSchema).max(ADMIN_MAP_MAX_CELL_COUNT),
  entities: z.array(adminMapEntitySchema).max(2048),
}).strict();
const adminPaletteSchema = z.object({
  enemies: z.array(z.string()).max(256),
  items: z.array(z.string()).max(256),
  weapons: z.array(z.string()).max(256),
  pets: z.array(z.string()).max(256),
}).strict();
const adminHistoryEntrySchema = z.object({
  at: z.number().int().nonnegative(), actor: z.string().min(1).max(96), action: z.string().min(1).max(32),
  ok: z.boolean(), code: z.string().min(1).max(32).optional(),
}).strict();
export const adminStateSchema = z.object({
  type: z.literal("adminState"), players: z.array(adminPlayerSchema),
  spectator: z.object({ mode: z.enum(["off", "free", "track"]), playerId: z.string().nullable() }).strict(),
  map: adminMapSchema, spectatorMap: adminMapSchema.nullable(), palette: adminPaletteSchema,
  debug: debugFlagsSchema, history: z.array(adminHistoryEntrySchema).max(24),
});
export const adminObserverStateSchema = z.object({
  type: z.literal("adminObserverState"), players: z.array(adminPlayerSchema),
  spectator: z.object({ mode: z.enum(["off", "free", "track"]), playerId: z.string().nullable() }).strict(),
  spectatorMap: adminMapSchema.nullable(),
});

export type AdminPlayer = z.infer<typeof adminPlayerSchema>;
export type AdminState = z.infer<typeof adminStateSchema>;
export type AdminObserverState = z.infer<typeof adminObserverStateSchema>;
export type AdminMap = z.infer<typeof adminMapSchema>;
export type AdminMapCell = z.infer<typeof adminMapCellSchema>;
export type AdminMapEntity = z.infer<typeof adminMapEntitySchema>;
export type AdminHitbox = z.infer<typeof adminHitboxSchema>;
export type AdminPalette = z.infer<typeof adminPaletteSchema>;
export type AdminHistoryEntry = z.infer<typeof adminHistoryEntrySchema>;
