import { type EffectEvent } from "@dc2d/engine";
import { combatants, effectTargetFor } from "../../core/helpers.js";
import { igniteEntity } from "../../progression/elemental/elementalIgnition.js";
import type {
  EnemySlot,
  SimState,
} from "../../state/state.js";
import type { DirectionalFlameState } from "../../state/enemyState.js";
import { ELEMENTAL_ENEMY_TUNING } from "./configuration/elementalEnemyTuning.js";
import { placeDirectionalFlameArea } from "./directionalFlameArea.js";
import { flameCellIsReachable } from "./flameBoundary.js";

export interface DirectionalFlameStart {
  readonly enemy: EnemySlot;
  readonly target: { readonly x: number; readonly y: number };
}

export interface DirectionalFlameStep {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly effectEvents: EffectEvent[];
}

export function beginDirectionalFlame(input: DirectionalFlameStart): void {
  const direction = flameDirection(input);
  const stepDistance = Math.hypot(direction.x, direction.y);
  const maximumSegments = Math.floor(
    ELEMENTAL_ENEMY_TUNING.directionalFlame.maximumRangeTiles /
      stepDistance,
  );
  input.enemy.elementalAttack = {
    kind: "directional-flame",
    originTileX: Math.floor(input.enemy.entity.body.x),
    originTileY: Math.floor(input.enemy.entity.body.y),
    stepX: direction.x,
    stepY: direction.y,
    maximumSegments,
    hitTargetIds: new Set(),
    nextSegment: 1,
    ticksUntilSegment: 0,
  };
}

function flameDirection(input: DirectionalFlameStart): {
  readonly x: number;
  readonly y: number;
} {
  const dx = Math.sign(input.target.x - input.enemy.entity.body.x);
  const dy = Math.sign(input.target.y - input.enemy.entity.body.y);
  if (dx !== 0 || dy !== 0) return { x: dx, y: dy };
  const facing = input.enemy.entity.facing ?? { x: 0, y: 1 };
  return { x: Math.sign(facing.x), y: Math.sign(facing.y) };
}

/** Returns true once the fixed segment has ended or terrain blocks it. */
export function stepDirectionalFlame(input: DirectionalFlameStep): boolean {
  const state = input.enemy.elementalAttack;
  if (!state) return true;
  if (state.ticksUntilSegment > 0) {
    state.ticksUntilSegment -= 1;
    return false;
  }
  const cell = flameCell(state);
  if (!flameCellIsReachable({ ...input, ...cell })) {
    delete input.enemy.elementalAttack;
    return true;
  }
  resolveFlameCell(input, state, cell);
  state.nextSegment += 1;
  state.ticksUntilSegment =
    ELEMENTAL_ENEMY_TUNING.directionalFlame.ticksPerSegment - 1;
  if (state.nextSegment <= state.maximumSegments) return false;
  delete input.enemy.elementalAttack;
  return true;
}

function flameCell(
  state: DirectionalFlameState,
): { readonly x: number; readonly y: number } {
  return {
    x: state.originTileX + state.stepX * state.nextSegment,
    y: state.originTileY + state.stepY * state.nextSegment,
  };
}

function resolveFlameCell(
  input: DirectionalFlameStep,
  state: DirectionalFlameState,
  cell: { readonly x: number; readonly y: number },
): void {
  const { sim, enemy } = input;
  placeDirectionalFlameArea({ ...input, cell });
  for (const entity of combatants(sim)) {
    if (!isFlameTarget({ enemy, state, entity, cell })) continue;
    applyFlameHit(input, state, entity);
  }
}

interface FlameTargetCheck {
  readonly enemy: EnemySlot;
  readonly state: DirectionalFlameState;
  readonly entity: ReturnType<typeof combatants>[number];
  readonly cell: { readonly x: number; readonly y: number };
}

function isFlameTarget(check: FlameTargetCheck): boolean {
  const { enemy, state, entity, cell } = check;
  return entity.kind === "player" &&
    entity.hp > 0 &&
    !state.hitTargetIds.has(entity.id) &&
    Math.floor(entity.body.x) === cell.x &&
    Math.floor(entity.body.y) === cell.y &&
    entity.id !== enemy.entity.id;
}

function applyFlameHit(
  input: DirectionalFlameStep,
  state: DirectionalFlameState,
  entity: ReturnType<typeof combatants>[number],
): void {
  const { sim, enemy, effectEvents } = input;
  state.hitTargetIds.add(entity.id);
  sim.effects.modifyHealth({
    entity,
    amount: -enemy.def.attack.damage,
    events: effectEvents,
    opts: {
      sourceTags: ["fire", ...enemy.def.tags],
      sourceId: enemy.entity.id,
    },
    target: effectTargetFor(sim, entity),
  });
  igniteEntity({
    sim,
    entity,
    effectEvents,
    statusId: ELEMENTAL_ENEMY_TUNING.directionalFlame.statusId,
    sourceId: enemy.entity.id,
  });
}
