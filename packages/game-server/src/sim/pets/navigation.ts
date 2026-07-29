import {
  CHASM_DEATH_Z,
  GRAVITY,
  JUMP_VELOCITY,
  STEP_UP,
  findGridPath,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { PET_FOLLOW_DISTANCE_TILES } from "./leash.js";
import type { PetPathStep, PetSlot } from "./types.js";

const PET_PATH_SAMPLE_TILES = 0.25;
const PET_PATH_MAX_EXPANSIONS = 640;
const PET_PATH_MARGIN = 8;
const PET_MAX_JUMP_RISE = JUMP_VELOCITY * JUMP_VELOCITY / (2 * GRAVITY) - 0.05;
/** A half-height block is a real ledge for pets, not a walk-up step. */
export const PET_JUMP_THRESHOLD = 0.5;

interface PetTargetInput {
  sim: SimState;
  pet: PetSlot;
  target: { x: number; y: number };
  owner?: { x: number; y: number };
}

function petJumpRequired(rise: number, onStair: boolean): boolean {
  if (onStair) return false;
  return rise >= PET_JUMP_THRESHOLD || rise > STEP_UP;
}

/** Keep idle drift on the owner's local, directly walkable floor. */
export function isPetDriftTargetReachable({ sim, pet, target, owner = target }: PetTargetInput): boolean {
  if (Math.hypot(target.x - owner.x, target.y - owner.y) > PET_FOLLOW_DISTANCE_TILES) return false;
  const start = pet.entity.body;
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  const steps = Math.ceil(distance / PET_PATH_SAMPLE_TILES);
  let previousX = start.x;
  let previousY = start.y;
  let previousGround = sim.world.groundAt(previousX, previousY);
  for (let step = 1; step <= steps; step++) {
    const sample = routeSample({ sim, start, target, step, steps, previousX, previousY, previousGround });
    if (!sample) return false;
    ({ x: previousX, y: previousY, ground: previousGround } = sample);
  }
  return true;
}

function routeSample(input: {
  sim: SimState;
  start: { x: number; y: number };
  target: { x: number; y: number };
  step: number;
  steps: number;
  previousX: number;
  previousY: number;
  previousGround: number;
}): { x: number; y: number; ground: number } | null {
  const { sim, start, target, step, steps, previousX, previousY, previousGround } = input;
  const progress = step / steps;
  const x = start.x + (target.x - start.x) * progress;
  const y = start.y + (target.y - start.y) * progress;
  if (!isWalkableSample(sim, x, y)) return null;
  const ground = sim.world.groundAt(x, y);
  const onStair = isStairTransition(sim, { previousX, previousY, x, y });
  return petJumpRequired(ground - previousGround, onStair) ? null : { x, y, ground };
}

function isWalkableSample(sim: SimState, x: number, y: number): boolean {
  return sim.world.isWalkable(Math.floor(x), Math.floor(y));
}

function isStairTransition(sim: SimState, input: { previousX: number; previousY: number; x: number; y: number }): boolean {
  return sim.world.stairHeightAt(input.previousX, input.previousY) !== null || sim.world.stairHeightAt(input.x, input.y) !== null;
}

export function petNeedsTraversal({ sim, pet, target }: PetTargetInput): boolean {
  const ownerGround = sim.world.groundAt(target.x, target.y);
  const ownerRise = ownerGround - pet.entity.body.z;
  return petJumpRequired(ownerRise, false) ||
    !isPetDriftTargetReachable({ sim, pet, target });
}

export function clearPetPath(pet: PetSlot, nextPathTick = 0): void {
  pet.path = [];
  pet.pathIndex = 0;
  pet.pathGoal = undefined;
  pet.nextPathTick = nextPathTick;
}

/** Pet-specific rules layered over the shared bounded grid search. */
export function findPetPath({ sim, pet, target }: PetTargetInput): PetPathStep[] {
  return findGridPath({
    world: sim.world,
    start: { x: pet.entity.body.x, y: pet.entity.body.y },
    goal: target,
    options: {
      maxExpansions: PET_PATH_MAX_EXPANSIONS,
      margin: PET_PATH_MARGIN,
      maxJumpRise: PET_MAX_JUMP_RISE,
      jumpThreshold: PET_JUMP_THRESHOLD,
      canEnter: ({ x, y }) => isPetPathTile(sim, x, y),
      canTraverse: petTraversal,
    },
  });
}

function isPetPathTile(sim: SimState, x: number, y: number): boolean {
  return sim.world.isWalkable(x, y) && sim.world.groundAt(x + 0.5, y + 0.5) > CHASM_DEATH_Z;
}

function petTraversal({ fromGround, toGround, onStair }: { fromGround: number; toGround: number; onStair: boolean }) {
  const rise = toGround - fromGround;
  if (!onStair && rise > PET_MAX_JUMP_RISE) return null;
  const jump = petJumpRequired(rise, onStair);
  return { jump, cost: jump ? 0.25 : 0 };
}
