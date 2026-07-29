import type { EffectEvent } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import {
  beginDirectionalFlame,
  stepDirectionalFlame,
} from "./directionalFlame.js";
import { launchOilLob } from "./oilLob.js";

export interface ElementalAttackStart {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly target: { readonly x: number; readonly y: number };
}

export function beginElementalEnemyAttack(
  input: ElementalAttackStart,
): boolean {
  const kind = input.enemy.def.attack.elemental;
  if (kind === "oil-lob") {
    launchOilLob(input);
    return true;
  }
  if (kind === "directional-flame") {
    beginDirectionalFlame(input);
    return true;
  }
  return false;
}

export function advanceElementalEnemyAttack(input: {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly effectEvents: EffectEvent[];
}): boolean | null {
  if (input.enemy.elementalAttack?.kind !== "directional-flame") return null;
  return stepDirectionalFlame(input);
}
