import type { AdminMapEntity, DebugFlags, Entity } from "@dc2d/engine";
import type { SimState } from "../state/state.js";

export interface AdminMapDebugInput {
  readonly sim: SimState;
  readonly entity: Pick<
    Entity,
    "id" | "kind" | "body" | "facing" | "directProjectileImpact" | "combatHurtbox"
  >;
  /** Omitted for the authenticated portal map, which retains every diagnostic. */
  readonly flags?: DebugFlags;
}

export type AdminEntityDebug = NonNullable<AdminMapEntity["debug"]>;

export function adminDebugFlagEnabled(
  input: AdminMapDebugInput,
  flag: keyof DebugFlags,
): boolean {
  return input.flags?.[flag] ?? true;
}
