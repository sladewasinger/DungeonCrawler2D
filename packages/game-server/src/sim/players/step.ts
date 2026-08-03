import {
  CORPNET_INPUT_LEASE_TICKS,
  STANDARD_INPUT_LEASE_TICKS,
  ADMIN_NOCLIP_SPEED,
  FALL_DAMAGE_BASE,
  FALL_DAMAGE_MIN_HEIGHT,
  FALL_DAMAGE_PER_UNIT,
  NEUTRAL_INPUT,
  TICK_DT,
  faceEntity,
  clampFiniteFloorPosition,
  stepBody,
  type EffectEvent,
  type Entity,
  type MoveInput,
} from "@dc2d/engine";
import { killIfInChasm } from "../combat/deaths.js";
import { effectTargetFor } from "../core/helpers.js";
import { advancePlayerResources } from "../progression/combatResources.js";
import { advanceInputTimeline } from "./playerInputTimeline.js";
import { endSpawnGrace } from "../spawnSafety/spawnSafety.js";
import type { PlayerSlot, SimState } from "../state/state.js";

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
  const timelineInput = advanceInputTimeline(slot) ?? NEUTRAL_INPUT;
  const input = advancePlayerResources(
    slot,
    inputWithinNetworkLease(sim, slot, timelineInput),
  );
  endGraceForMovement(slot, input);
  faceEntity(entity, input.faceX ?? input.moveX, input.faceY ?? input.moveY);
  const result = movePlayer({ sim, slot, entity, input, tags });
  if (result.landed) applyLandingDamage({ ...context, entity, tags, fallHeight: result.landed.fallHeight });
  killIfInChasm(slot, sim.world);
}

function inputWithinNetworkLease(
  sim: SimState,
  slot: PlayerSlot,
  input: MoveInput,
): MoveInput {
  const receivedAtTick = slot.lastInputReceivedAtTick ?? sim.tickCount;
  const leaseTicks = slot.networkProfile === "corpnet"
    ? CORPNET_INPUT_LEASE_TICKS
    : STANDARD_INPUT_LEASE_TICKS;
  if (sim.tickCount - receivedAtTick < leaseTicks) return input;
  delete slot.heldInput;
  return NEUTRAL_INPUT;
}

function endGraceForMovement(slot: PlayerSlot, input: { moveX: number; moveY: number; jump: boolean }): void {
  if (input.moveX !== 0 || input.moveY !== 0 || input.jump) endSpawnGrace(slot);
}

function movePlayer({ sim, slot, entity, input, tags }: {
  sim: SimState;
  slot: PlayerSlot;
  entity: Entity;
  input: MoveInput;
  tags: Set<string>;
}) {
  const before = { x: entity.body.x, y: entity.body.y };
  const result = stepBody(sim.world, entity.body, input, TICK_DT, movementOptions({ sim, slot, entity, tags }));
  clampNoclipToFloor(sim, slot);
  sim.replicationMotion.set(entity.id, movementSince(entity, before));
  return result;
}

function clampNoclipToFloor(sim: SimState, slot: PlayerSlot): void {
  if (!slot.noclip) return;
  const position = clampFiniteFloorPosition(sim.world.floorBounds, slot.entity.body);
  slot.entity.body.x = position.x;
  slot.entity.body.y = position.y;
}

function movementOptions(input: { readonly sim: SimState; readonly slot: PlayerSlot; readonly entity: Entity; readonly tags: Set<string> }) {
  return {
    speed: input.slot.noclip ? ADMIN_NOCLIP_SPEED : input.sim.effects.movementSpeed(input.entity),
    stickyFeet: input.tags.has("sticky-feet"),
    noclip: input.slot.noclip === true,
  };
}

function movementSince(entity: Entity, before: { x: number; y: number }) {
  return { x: (entity.body.x - before.x) / TICK_DT, y: (entity.body.y - before.y) / TICK_DT };
}

function applyLandingDamage(context: LandingContext): void {
  if (!shouldDamageForLanding(context)) return;
  const { sim, entity, fallHeight, effectEvents } = context;
  sim.effects.modifyHealth({
    entity,
    amount: -fallDamageForHeight(fallHeight),
    events: effectEvents,
    opts: { sourceTags: ["fall"] },
    target: effectTargetFor(sim, entity, { spawnProtection: false }),
  });
}

function fallDamageForHeight(fallHeight: number): number {
  return FALL_DAMAGE_BASE +
    (fallHeight - FALL_DAMAGE_MIN_HEIGHT) * FALL_DAMAGE_PER_UNIT;
}

function shouldDamageForLanding({ sim, entity, fallHeight, tags }: LandingContext): boolean {
  if (fallHeight < FALL_DAMAGE_MIN_HEIGHT || tags.has("feather-fall")) return false;
  return !sim.areas.hasTagAt(Math.floor(entity.body.x), Math.floor(entity.body.y), "liquid");
}
