import type { ActiveStatus } from "../../entities/entity.js";
import type { StatusDef } from "../types.js";

/** Apply a status definition's stacking policy to an active status. */
export function restackStatus(
  existing: ActiveStatus,
  definition: StatusDef,
): boolean {
  if (definition.stacking === "ignore") return false;
  if (definition.stacking === "refresh") {
    existing.remaining = definition.duration;
    existing.tickAccum = 0;
    return true;
  }
  if (existing.stacks >= (definition.maxStacks ?? 3)) return false;
  existing.stacks++;
  existing.remaining = definition.duration;
  return true;
}
