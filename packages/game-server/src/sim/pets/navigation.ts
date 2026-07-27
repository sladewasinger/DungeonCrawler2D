import {
  CHASM_DEATH_Z,
  GRAVITY,
  JUMP_VELOCITY,
  STEP_UP,
  findGridPath,
} from "@dc2d/engine";
import type { SimState } from "../state.js";
import { PET_FOLLOW_DISTANCE_TILES } from "./leash.js";
import type { PetPathStep, PetSlot } from "./types.js";

const PET_PATH_SAMPLE_TILES = 0.25;
const PET_PATH_MAX_EXPANSIONS = 640;
const PET_PATH_MARGIN = 8;
const PET_MAX_JUMP_RISE = JUMP_VELOCITY * JUMP_VELOCITY / (2 * GRAVITY) - 0.05;
/** A half-height block is a real ledge for pets, not a walk-up step. */
export const PET_JUMP_THRESHOLD = 0.5;

function petJumpRequired(rise: number, onStair: boolean): boolean {
  if (onStair) return false;
  return rise >= PET_JUMP_THRESHOLD || rise > STEP_UP;
}

/** Keep idle drift on the owner's local, directly walkable floor. */
export function isPetDriftTargetReachable(
  sim: SimState,
  pet: PetSlot,
  target: { x: number; y: number },
  ownerX: number,
  ownerY: number,
): boolean {
  if (Math.hypot(target.x - ownerX, target.y - ownerY) > PET_FOLLOW_DISTANCE_TILES) return false;
  const start = pet.entity.body;
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  const steps = Math.ceil(distance / PET_PATH_SAMPLE_TILES);
  let previousX = start.x;
  let previousY = start.y;
  let previousGround = sim.world.groundAt(previousX, previousY);
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    const x = start.x + (target.x - start.x) * progress;
    const y = start.y + (target.y - start.y) * progress;
    if (!sim.world.isWalkable(Math.floor(x), Math.floor(y))) return false;
    const ground = sim.world.groundAt(x, y);
    const onStair = sim.world.stairHeightAt(previousX, previousY) !== null ||
      sim.world.stairHeightAt(x, y) !== null;
    // A direct drift route cannot jump. Keep stair ramps walkable, but make
    // any non-stair rise above the grounded step-up limit invoke A* instead.
    if (petJumpRequired(ground - previousGround, onStair)) return false;
    previousX = x;
    previousY = y;
    previousGround = ground;
  }
  return true;
}

export function petNeedsTraversal(
  sim: SimState,
  pet: PetSlot,
  ownerX: number,
  ownerY: number,
): boolean {
  const ownerGround = sim.world.groundAt(ownerX, ownerY);
  const ownerRise = ownerGround - pet.entity.body.z;
  return petJumpRequired(ownerRise, false) ||
    !isPetDriftTargetReachable(sim, pet, { x: ownerX, y: ownerY }, ownerX, ownerY);
}

export function clearPetPath(pet: PetSlot, nextPathTick = 0): void {
  pet.path = [];
  pet.pathIndex = 0;
  pet.pathGoal = undefined;
  pet.nextPathTick = nextPathTick;
}

/** Pet-specific rules layered over the shared bounded grid search. */
export function findPetPath(
  sim: SimState,
  pet: PetSlot,
  ownerX: number,
  ownerY: number,
): PetPathStep[] {
  return findGridPath(
    sim.world,
    { x: pet.entity.body.x, y: pet.entity.body.y },
    { x: ownerX, y: ownerY },
    {
      maxExpansions: PET_PATH_MAX_EXPANSIONS,
      margin: PET_PATH_MARGIN,
      maxJumpRise: PET_MAX_JUMP_RISE,
      jumpThreshold: PET_JUMP_THRESHOLD,
      canEnter: (x, y) => sim.world.isWalkable(x, y) &&
        sim.world.groundAt(x + 0.5, y + 0.5) > CHASM_DEATH_Z,
      canTraverse: (_fromX, _fromY, _toX, _toY, fromGround, toGround, onStair) => {
        const rise = toGround - fromGround;
        if (!onStair && rise > PET_MAX_JUMP_RISE) return null;
        const jump = petJumpRequired(rise, onStair);
        return { jump, cost: jump ? 0.25 : 0 };
      },
    },
  );
}
