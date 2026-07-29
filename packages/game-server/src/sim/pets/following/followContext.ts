import type { PlayerSlot, SimState } from "../../state/state.js";
import type { PetSlot } from "../types.js";

export interface PetFollowContext {
  readonly sim: SimState;
  readonly pet: PetSlot;
  readonly owner: PlayerSlot;
  readonly target: { readonly x: number; readonly y: number };
  readonly distance: number;
}

export function petFollowContext(
  input: Omit<PetFollowContext, "target" | "distance">,
): PetFollowContext {
  const { x, y } = input.owner.entity.body;
  return {
    ...input,
    target: { x, y },
    distance: Math.hypot(
      x - input.pet.entity.body.x,
      y - input.pet.entity.body.y,
    ),
  };
}
