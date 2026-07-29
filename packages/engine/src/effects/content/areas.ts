// Area-effect defs — spreading ground hazards/buffs (fire, poison gas, water) and their tiles.
import { z } from "zod";

/** Proposal-safe bounds; authored area lifetimes currently top out at 40s. */
export const MAX_AREA_DURATION_SECONDS = 300;
export const MAX_AREA_TAGS = 12;

export const areaDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tags: z.array(z.string()).max(MAX_AREA_TAGS),
  /**
   * One effect per channel may remain after reactions settle. Different
   * channels compose; an incoming effect replaces an unresolved peer in its
   * own channel.
   */
  channel: z.enum(["surface", "flame", "gas"]),
  /** Resolves different effects competing for the same channel. */
  priority: z.number().int().min(0).max(100),
  /** -1 sinks/flows downhill, 0 stays, +1 rises/drifts uphill. */
  buoyancy: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  /** Seconds a tile of this area lives. */
  duration: z.number().positive().max(MAX_AREA_DURATION_SECONDS),
  /** Status applied to grounded entities standing in it. */
  onEnterStatus: z.string().optional(),
  /** Spread to adjacent tiles: chance per tick per tile. */
  spread: z
    .object({
      chance: z.number().min(0).max(1),
      /** Only spread onto tiles carrying an area with this tag (fuel). */
      ontoAreaTag: z.string().optional(),
      /** Max generations of spread from the origin. */
      maxSteps: z.number().int().min(0).max(20),
    })
    .optional(),
  /** Atlas frame key for rendering. */
  sprite: z.string(),
}).strict();
export type AreaDef = z.infer<typeof areaDefSchema>;
