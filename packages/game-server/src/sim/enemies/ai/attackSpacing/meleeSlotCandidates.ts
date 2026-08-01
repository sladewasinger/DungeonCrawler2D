import {
  combatHurtbox,
  reachesHurtbox,
  type Entity,
} from "@dc2d/engine";
import {
  ATTACK_SLOT_REACHED_EPSILON,
  type MeleeSlotCandidate,
} from "./attackSpacingTypes.js";

const MELEE_SLOT_DIRECTIONS: readonly { x: number; y: number }[] = [
  { x: 1, y: 0 },
  { x: 0.8660254038, y: 0.5 },
  { x: 0.5, y: 0.8660254038 },
  { x: 0, y: 1 },
  { x: -0.5, y: 0.8660254038 },
  { x: -0.8660254038, y: 0.5 },
  { x: -1, y: 0 },
  { x: -0.8660254038, y: -0.5 },
  { x: -0.5, y: -0.8660254038 },
  { x: 0, y: -1 },
  { x: 0.5, y: -0.8660254038 },
  { x: 0.8660254038, y: -0.5 },
];

export function meleeCandidates(
  target: Entity,
  attackRange: number,
): readonly MeleeSlotCandidate[] {
  const directional = MELEE_SLOT_DIRECTIONS.map((direction) => {
    const radius = meleeSlotRadius(target, attackRange, direction);
    return {
      x: target.body.x + direction.x * radius,
      y: target.body.y + direction.y * radius,
      z: target.body.z,
      canShare: false,
    };
  });
  return [...directional, {
    x: target.body.x,
    y: target.body.y,
    z: target.body.z,
    canShare: true,
  }];
}

function meleeSlotRadius(
  target: Entity,
  attackRange: number,
  direction: { x: number; y: number },
): number {
  const hurtbox = combatHurtbox(target);
  let reachableRadius = 0;
  let unreachableRadius = attackRange +
    Math.max(hurtbox.halfWidth, hurtbox.halfDepth) + 1;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const radius = (reachableRadius + unreachableRadius) / 2;
    if (pointReachesTarget({ target, attackRange, direction, radius })) {
      reachableRadius = radius;
    } else {
      unreachableRadius = radius;
    }
  }
  return Math.max(0.2, reachableRadius - ATTACK_SLOT_REACHED_EPSILON);
}

function pointReachesTarget(input: {
  target: Entity;
  attackRange: number;
  direction: { x: number; y: number };
  radius: number;
}): boolean {
  const { target, attackRange, direction, radius } = input;
  return reachesHurtbox({
    body: {
      ...target.body,
      x: target.body.x + direction.x * radius,
      y: target.body.y + direction.y * radius,
    },
  }, target, attackRange);
}
