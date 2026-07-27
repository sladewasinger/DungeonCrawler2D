import {
  INTERACT_RANGE,
  MAX_THROW_RANGE,
  THROW_SPEED,
  createBody,
  faceEntity,
  launchVelocity,
  makeEntity,
  newEntityId,
  type EffectEvent,
} from "@dc2d/engine";
import { invQty, invRemove } from "../inventory.js";
import type { PlayerAction, PlayerSlot, SimState } from "../state.js";
import { doThrowTorch } from "../torches.js";

/** Hotbar item use: throwables launch a projectile, consumables run their effects. */

interface ItemUseContext {
  sim: SimState;
  slot: PlayerSlot;
  defId: string;
  effectEvents: EffectEvent[];
}

interface ItemThrowContext extends ItemUseContext {
  tags: readonly string[];
  targetX: number;
  targetY: number;
}

interface ItemActionContext {
  sim: SimState;
  slot: PlayerSlot;
  action: PlayerAction;
  effectEvents: EffectEvent[];
}

export function doUseSlot({ sim, slot, action, effectEvents }: ItemActionContext): void {
  if (action.type !== "useSlot") return;
  const defId = slot.hotbar[action.slot];
  if (!defId) return;
  const def = sim.content.items.get(defId);
  if (!def || invQty(slot, defId) < 1) return;
  const context = { sim, slot, defId, effectEvents };
  useSlottedItem(context, def.throwable ? def.tags : undefined, action);
}

function useSlottedItem(context: ItemUseContext, tags: readonly string[] | undefined, action: Extract<PlayerAction, { type: "useSlot" }>): void {
  if (action.targetId !== undefined) return useBandageOnPlayer({ ...context, targetId: action.targetId });
  if (canThrowAt(action, tags)) return throwItem({ ...context, tags: tags ?? [], targetX: action.targetX, targetY: action.targetY });
  consumeItem(context);
}

function canThrowAt(action: Extract<PlayerAction, { type: "useSlot" }>, tags: readonly string[] | undefined): action is Extract<PlayerAction, { type: "useSlot" }> & { targetX: number; targetY: number } {
  return tags !== undefined && action.targetX !== undefined && action.targetY !== undefined;
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
  const from = slot.entity.body;
  let dx = targetX - from.x;
  let dy = targetY - from.y;
  const dist = Math.hypot(dx, dy);
  faceEntity(slot.entity, dx, dy);
  if (dist > MAX_THROW_RANGE) {
    dx *= MAX_THROW_RANGE / dist;
    dy *= MAX_THROW_RANGE / dist;
  }
  const to = {
    x: from.x + dx,
    y: from.y + dy,
    z: sim.world.groundAt(from.x + dx, from.y + dy),
  };
  const projectile = makeEntity("projectile", createBody(from.x, from.y, from.z + 1), {
    id: newEntityId("j"),
    defId,
    ownerId: slot.entity.id,
    tags: new Set(tags),
    vel: launchVelocity({ x: from.x, y: from.y, z: from.z + 1 }, to, THROW_SPEED),
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
      doThrowTorch({ sim, slot, dirX: action.dirX, dirY: action.dirY });
      break;
  }
}
