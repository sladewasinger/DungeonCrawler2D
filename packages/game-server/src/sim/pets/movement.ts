import {
  TICK_DT,
  faceEntity,
  stepBody,
  type MoveInput,
  type StepResult,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import type { PetSlot } from "./types.js";

interface PetMovementInput {
  readonly sim: SimState;
  readonly pet: PetSlot;
  readonly move: MoveInput;
}

/** Advances horizontal collision and vertical physics exactly once. */
export function advancePetBody(input: PetMovementInput): StepResult {
  const { sim, pet, move } = input;
  const entity = pet.entity;
  const before = { x: entity.body.x, y: entity.body.y };
  if (move.moveX !== 0 || move.moveY !== 0) {
    faceEntity(entity, move.moveX, move.moveY);
  }
  const result = stepBody(
    sim.world,
    entity.body,
    move,
    TICK_DT,
    { speed: pet.definition.speed },
  );
  sim.replicationMotion.set(entity.id, {
    x: (entity.body.x - before.x) / TICK_DT,
    y: (entity.body.y - before.y) / TICK_DT,
  });
  return result;
}
