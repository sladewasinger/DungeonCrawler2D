import {
  INTERACT_RANGE,
  createBody,
  createBallisticFlight,
  faceEntity,
  makeEntity,
  newEntityId,
  resolveBallisticThrow,
  throwLaunchOrigin,
} from "@dc2d/engine";
import { invQty, invRemove } from "../inventory/inventory.js";
import type { PlayerSlot } from "../state/state.js";
import {
  doThrowLegacyTorch,
  doThrowTorch,
} from "../combat/torches.js";
import type {
  ItemActionContext,
  ItemThrowContext,
  ItemUseContext,
  SlottedItemContext,
  ThrowableItemContext,
  UseSlotAction,
} from "./itemActionContext.js";

/** Hotbar item use: throwables launch a projectile, consumables run their effects. */

export function doUseSlot({ sim, slot, action, effectEvents }: ItemActionContext): void {
  if (action.type !== "useSlot") return;
  const defId = slot.hotbar[action.slot];
  if (!defId) return;
  const def = sim.content.items.get(defId);
  if (!def || invQty(slot, defId) < 1) return;
  const context = { sim, slot, defId, effectEvents };
  useSlottedItem({
    ...context,
    tags: def.tags,
    throwable: def.throwable,
    action,
  });
}

function useSlottedItem(context: SlottedItemContext): void {
  const { action, throwable } = context;
  if (action.targetId !== undefined) return useBandageOnPlayer({ ...context, targetId: action.targetId });
  if (throwable && hasThrowTarget(action)) {
    return throwSlottedItem({ ...context, action, throwable });
  }
  consumeItem(context);
}

function hasThrowTarget(
  action: UseSlotAction,
): action is UseSlotAction & {
  targetX: number;
  targetY: number;
} {
  return action.targetX !== undefined &&
    action.targetY !== undefined;
}

function throwSlottedItem(context: ThrowableItemContext): void {
  const { action, throwable } = context;
  const target = { targetX: action.targetX, targetY: action.targetY };
  if (throwable.placesEntity === "torch") {
    doThrowTorch({ ...context, ...target });
    return;
  }
  throwItem({ ...context, tags: context.tags, ...target });
}

function useBandageOnPlayer(context: ItemUseContext & { targetId: string }): void {
  const { sim, slot, defId, effectEvents } = context;
  const target = bandageTargetFor(context);
  if (!target) return;
  if (!isWithinBandageRange(slot, target)) return;
  const consumable = sim.content.items.get(defId)?.consumable;
  if (!consumable) return;
  sim.effects.runPrimitives({ entity: target.entity, primitives: consumable.effects, events: effectEvents, rng: () => sim.rng.next() });
  invRemove(slot, defId, 1);
}

function bandageTargetFor({ sim, slot, defId, targetId }: ItemUseContext & { targetId: string }): PlayerSlot | undefined {
  if (defId !== "bandage") return undefined;
  if (targetId === slot.entity.id) return undefined;
  const target = sim.players.get(targetId);
  if (!target?.connected) return undefined;
  return target.entity.hp > 0 ? target : undefined;
}

function isWithinBandageRange(slot: PlayerSlot, target: PlayerSlot): boolean {
  const from = slot.entity.body;
  const to = target.entity.body;
  return Math.hypot(to.x - from.x, to.y - from.y) <= INTERACT_RANGE;
}

export function doUseItem({ sim, slot, defId, effectEvents }: ItemUseContext): void {
  if (invQty(slot, defId) < 1) return;
  consumeItem({ sim, slot, defId, effectEvents });
}

function consumeItem({ sim, slot, defId, effectEvents }: ItemUseContext): void {
  const consumable = sim.content.items.get(defId)?.consumable;
  if (!consumable) return;
  sim.effects.runPrimitives({ entity: slot.entity, primitives: consumable.effects, events: effectEvents, rng: () => sim.rng.next() });
  invRemove(slot, defId, 1);
}

function throwItem({ sim, slot, defId, tags, targetX, targetY }: ItemThrowContext): void {
  const body = slot.entity.body;
  const from = throwLaunchOrigin(body);
  faceEntity(slot.entity, targetX - body.x, targetY - body.y);
  const ballistic = resolveBallisticThrow({
    world: sim.world,
    from,
    target: { x: targetX, y: targetY },
  });
  const projectile = makeEntity("projectile", createBody(from.x, from.y, from.z), {
    id: newEntityId("j"),
    defId,
    ownerId: slot.entity.id,
    tags: new Set(tags),
    vel: ballistic.vel,
    ballisticFlight: createBallisticFlight(from, ballistic),
  });
  sim.projectiles.set(projectile.id, projectile);
  invRemove(slot, defId, 1);
}

/** Dispatches the three inventory-use action shapes split from actions/index.ts. */
export function dispatchItemAction(context: ItemActionContext): void {
  const { sim, slot, action, effectEvents } = context;
  switch (action.type) {
    case "useSlot":
      doUseSlot(context);
      break;
    case "useItem":
      doUseItem({ sim, slot, defId: action.item, effectEvents });
      break;
    case "throwTorch":
      doThrowLegacyTorch({ sim, slot, dirX: action.dirX, dirY: action.dirY });
      break;
  }
}
