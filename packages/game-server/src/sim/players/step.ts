import {
  FALL_DAMAGE_PER_UNIT,
  NEUTRAL_INPUT,
  SAFE_FALL_HEIGHT,
  TICK_DT,
  faceEntity,
  stepBody,
  type EffectEvent,
  type Entity,
  type MoveInput,
} from "@dc2d/engine";
import { killIfInChasm } from "../deaths.js";
import { effectTargetFor } from "../helpers.js";
import { advancePlayerResources } from "../combatResources.js";
import { advanceInputTimeline } from "../playerInputTimeline.js";
import { endSpawnGrace } from "../spawnSafety.js";
import type { PlayerSlot, SimState } from "../state.js";

interface PlayerStepContext {
  sim: SimState;
  slot: PlayerSlot;
  effectEvents: EffectEvent[];
}

interface LandingContext extends PlayerStepContext {
  entity: Entity;
  fallHeight: number;
  tags: Set<string>;
}

/** Advances one body with the control state due on its client timeline. */
export function stepPlayerBody(context: PlayerStepContext): void {
  const { sim, slot } = context;
  const entity = slot.entity;
  const tags = sim.effects.tagsOf(entity);
  const input = advancePlayerResources(slot, advanceInputTimeline(slot) ?? NEUTRAL_INPUT);
  endGraceForMovement(slot, input);
  faceEntity(entity, input.faceX ?? input.moveX, input.faceY ?? input.moveY);
  const result = movePlayer({ sim, entity, input, tags });
  if (result.landed) applyLandingDamage({ ...context, entity, tags, fallHeight: result.landed.fallHeight });
  killIfInChasm(slot, sim.world);
}

function endGraceForMovement(slot: PlayerSlot, input: { moveX: number; moveY: number; jump: boolean }): void {
  if (input.moveX !== 0 || input.moveY !== 0 || input.jump) endSpawnGrace(slot);
}

function movePlayer({ sim, entity, input, tags }: {
  sim: SimState;
  entity: Entity;
  input: MoveInput;
  tags: Set<string>;
}) {
  const before = { x: entity.body.x, y: entity.body.y };
  const result = stepBody(sim.world, entity.body, input, TICK_DT, playerMovementOptions(sim, entity, tags));
  sim.replicationMotion.set(entity.id, movementSince(entity, before));
  return result;
}

function playerMovementOptions(sim: SimState, entity: Entity, tags: Set<string>) {
  return { speed: entity.baseSpeed * sim.effects.speedMult(entity), stickyFeet: tags.has("sticky-feet") };
}

function movementSince(entity: Entity, before: { x: number; y: number }) {
  return { x: (entity.body.x - before.x) / TICK_DT, y: (entity.body.y - before.y) / TICK_DT };
}

function applyLandingDamage(context: LandingContext): void {
  if (!shouldDamageForLanding(context)) return;
  const { sim, entity, fallHeight, effectEvents } = context;
  sim.effects.modifyHealth({
    entity,
    amount: -(fallHeight - SAFE_FALL_HEIGHT) * FALL_DAMAGE_PER_UNIT,
    events: effectEvents,
    opts: { sourceTags: ["fall"] },
    target: effectTargetFor(sim, entity, { spawnProtection: false }),
  });
}

function shouldDamageForLanding({ sim, entity, fallHeight, tags }: LandingContext): boolean {
  if (fallHeight <= SAFE_FALL_HEIGHT || tags.has("feather-fall")) return false;
  return !sim.areas.hasTagAt(Math.floor(entity.body.x), Math.floor(entity.body.y), "liquid");
}
