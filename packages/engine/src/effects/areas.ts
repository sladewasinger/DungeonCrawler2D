// Area-effect defs — spreading ground hazards/buffs (fire, poison gas, water) and their tiles.
import { z } from "zod";

export const areaDefSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  /** -1 sinks/flows downhill, 0 stays, +1 rises/drifts uphill. */
  buoyancy: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  /** Seconds a tile of this area lives. */
  duration: z.number().positive(),
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
});
export type AreaDef = z.infer<typeof areaDefSchema>;
