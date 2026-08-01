import { NEUTRAL_INPUT, type EnemyDecision } from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";
import {
  ATTACK_KIND,
  type AttackRequest,
} from "./attackSpacingTypes.js";
import {
  type Point,
  type SpreadVector,
  chooseRangedSelection,
  isRangedFiringPointReachable as isSelectionFiringPointReachable,
} from "./rangedSpacingSelection.js";
import {
  attackSeed,
  isAtAttackSlot,
  rangedDirectionKey,
} from "./attackSpacingUtils.js";

type RangedRequest = { sim: SimState; targetId: string; requests: readonly AttackRequest[]; decisions: Map<string, EnemyDecision>; initialOccupied?: ReadonlySet<string> };
type RangedSlotInput = {
  sim: SimState;
  decisions: Map<string, EnemyDecision>;
  request: AttackRequest;
  spread: SpreadVector;
  point: Point;
  enforcePositioning: boolean;
};
type RangedRoutingInput = {
  readonly input: RangedRequest;
  readonly request: AttackRequest;
  readonly occupied: Set<string>;
  readonly enforcePositioning: boolean;
};

export function applyRangedSpread(input: RangedRequest): void {
  const occupied = new Set(input.initialOccupied ?? []);
  const ordered = [...input.requests].sort(
    (left, right) => attackDecisionOrder(input.targetId, left.enemy.entity.id, right.enemy.entity.id),
  );
  const enforcePositioning = ordered.length > 1;
  for (const request of ordered) {
    applyRangedRequest({ input, request, occupied, enforcePositioning });
  }
}

function applyRangedRequest(input: RangedRoutingInput): void {
  const selection = chooseRangedSelection({
    sim: input.input.sim,
    enemy: input.request.enemy,
    target: input.request.target,
    targetId: input.input.targetId,
    occupied: input.occupied,
    attackRange: input.request.enemy.def.attack.range,
  });
  input.request.enemy.attackReservation = {
    kind: ATTACK_KIND.rangedAim,
    targetId: input.input.targetId,
    directionX: selection.direction.x,
    directionY: selection.direction.y,
    x: selection.point.x,
    y: selection.point.y,
    updatedAtTick: input.input.sim.tickCount,
  };
  input.occupied.add(rangedDirectionKey(selection.direction));
  routeRangedDecision({
    sim: input.input.sim,
    decisions: input.input.decisions,
    request: input.request,
    spread: selection.aimOffset,
    point: selection.point,
    enforcePositioning: input.enforcePositioning,
  });
}

function routeRangedDecision(input: RangedSlotInput): void {
  if (shouldShootRangedRequest(input)) {
    setRangedShootDecision(input.decisions, input.request, input.spread);
    return;
  }
  setRangedPursuitDecision(input.decisions, input.request, input.point);
}

function shouldShootRangedRequest(input: RangedSlotInput): boolean {
  return isAtAttackSlot(input.request.enemy.entity.body, input.point) ||
    !isSelectionFiringPointReachable(input.sim, input.request.enemy, input.point) ||
    (!input.enforcePositioning && isInRangedAttackRange(input.request));
}

function setRangedShootDecision(
  decisions: Map<string, EnemyDecision>,
  request: AttackRequest,
  spread: SpreadVector,
): void {
  const isDirectionalFlame = request.enemy.def.attack.elemental === "directional-flame";
  const shotTargetX = isDirectionalFlame ? request.target.body.x : request.target.body.x + spread.x;
  const shotTargetY = isDirectionalFlame ? request.target.body.y : request.target.body.y + spread.y;
  const shoot = {
      targetId: request.target.id,
      x: shotTargetX,
      y: shotTargetY,
      z: request.target.body.z,
      ...(isDirectionalFlame ? {} : {
        spreadX: spread.x,
        spreadY: spread.y,
      }),
  };
  decisions.set(request.enemy.entity.id, {
    ...request.decision,
    shoot,
    move: NEUTRAL_INPUT,
  });
}

function setRangedPursuitDecision(
  decisions: Map<string, EnemyDecision>,
  request: AttackRequest,
  point: Point,
): void {
  const { strike: removedStrike, shoot: removedShoot, ...rest } = request.decision;
  void removedStrike;
  void removedShoot;
  decisions.set(request.enemy.entity.id, {
    ...rest,
    move: NEUTRAL_INPUT,
    pursuit: point,
  });
}

function isInRangedAttackRange(request: AttackRequest): boolean {
  return Math.hypot(
    request.enemy.entity.body.x - request.target.body.x,
    request.enemy.entity.body.y - request.target.body.y,
  ) <= request.enemy.def.attack.range;
}

function attackDecisionOrder(targetId: string, leftId: string, rightId: string): number {
  const leftSeed = attackSeed(leftId, targetId);
  const rightSeed = attackSeed(rightId, targetId);
  if (leftSeed !== rightSeed) return leftSeed - rightSeed;
  return leftId.localeCompare(rightId);
}
