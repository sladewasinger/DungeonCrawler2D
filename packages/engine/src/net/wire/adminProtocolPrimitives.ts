import { z } from "zod";
import { LEVEL_IDS } from "../../world/core/level.js";

export const adminPlayerTargetSchema = z.string().min(1).max(64);
export const adminDestinationSchema = z.enum(["spawn", "safeRoom", "self", "player", "coordinates"]);
export const adminLevelSchema = z.enum(LEVEL_IDS);
export const ADMIN_MAP_MAX_RADIUS = 24;
export const ADMIN_MAP_MAX_CELL_COUNT = (ADMIN_MAP_MAX_RADIUS * 2 + 1) ** 2;
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
