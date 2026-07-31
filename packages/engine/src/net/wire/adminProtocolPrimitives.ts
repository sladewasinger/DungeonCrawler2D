import { z } from "zod";

export const adminPlayerTargetSchema = z.string().min(1).max(64);
export const adminDestinationSchema = z.enum(["spawn", "safeRoom", "self", "player", "coordinates"]);
export const adminLevelSchema = z.enum(["dungeon", "sandbox"]);
/**
 * Reserved rooms live beyond the ordinary dungeon play area: the shared spawn
 * room is currently at y=131,072. Keep the admin protocol finite without
 * rejecting legitimate map views, player locations, or tile centers there.
 */
export const ADMIN_WORLD_COORDINATE_LIMIT = 1_000_000;
export const adminCoordinateSchema = z.number()
  .finite()
  .min(-ADMIN_WORLD_COORDINATE_LIMIT)
  .max(ADMIN_WORLD_COORDINATE_LIMIT);
export const adminTileCoordinateSchema = z.number()
  .finite()
  .int()
  .min(-ADMIN_WORLD_COORDINATE_LIMIT)
  .max(ADMIN_WORLD_COORDINATE_LIMIT);
export const adminEntityIdSchema = z.string().min(1).max(64);
export const adminDirectionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
}).strict();
