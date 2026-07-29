import type { EffectEvent } from "@dc2d/engine";
import { resolveFireContact } from "../../progression/elemental/fireContact.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ELEMENTAL_ENEMY_TUNING } from "./configuration/elementalEnemyTuning.js";

interface DirectionalFlameArea {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly effectEvents: EffectEvent[];
  readonly cell: { readonly x: number; readonly y: number };
}

/** Ignites existing fuel or places the Chort's short-lived flame area. */
export function placeDirectionalFlameArea(input: DirectionalFlameArea): void {
  if (igniteFuel(input)) return;
  input.sim.areas.place({
    defId: ELEMENTAL_ENEMY_TUNING.directionalFlame.areaId,
    x: input.cell.x,
    y: input.cell.y,
    steps: 0,
    sourceId: input.enemy.entity.id,
  });
}

function igniteFuel(input: DirectionalFlameArea): boolean {
  return resolveFireContact({
    sim: input.sim,
    source: {
      tags: new Set(["fire"]),
      sourceId: input.enemy.entity.id,
    },
    target: { kind: "area", x: input.cell.x, y: input.cell.y },
    effectEvents: input.effectEvents,
  });
}
